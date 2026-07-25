<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Enums\Ogc\ResultCollectionStatus;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Support\Str;

class CollectProcessExecutionResults
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    public function handle(ProcessExecution $execution): void
    {
        if (
            $execution->status !== ExecutionStatus::Successful
            || $execution->result_collection_status === ResultCollectionStatus::Successful
            || blank($execution->remote_job_id)
        ) {
            return;
        }

        $execution->update([
            'result_collection_status' => ResultCollectionStatus::Collecting,
            'result_collection_error' => null,
        ]);

        $job = $this->client->job($execution->remote_job_id);
        $resultLink = collect($job['links'] ?? [])
            ->first(fn (array $link): bool => str_contains(
                (string) ($link['rel'] ?? ''),
                'results',
            ));

        if (is_array($resultLink) && $this->shouldDeferResultDownload($resultLink)) {
            $this->storeProcessResult->fromLink($execution, $resultLink);
        } else {
            $this->storeProcessResult->fromResponse(
                $execution,
                $this->client->jobResults($execution->remote_job_id),
            );
        }

        $execution->update([
            'result_collection_status' => ResultCollectionStatus::Successful,
            'result_collection_error' => null,
        ]);
        $execution->refresh();

        $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());
    }

    /**
     * @param  array<string, mixed>  $link
     */
    private function shouldDeferResultDownload(array $link): bool
    {
        $mediaType = Str::of((string) ($link['type'] ?? ''))
            ->before(';')
            ->trim()
            ->lower()
            ->toString();

        return filled($mediaType)
            && ! str_starts_with($mediaType, 'multipart/')
            && ! str_contains($mediaType, 'application/json')
            && ! str_starts_with($mediaType, 'text/');
    }
}
