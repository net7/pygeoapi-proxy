<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use App\Services\Ogc\OgcProcessesClient;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Str;

class PollProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    public function handle(ProcessExecution $execution): void
    {
        if ($execution->status->isTerminal() || blank($execution->remote_job_id)) {
            return;
        }

        try {
            $job = $this->client->job($execution->remote_job_id);
        } catch (RequestException $exception) {
            if ($exception->response->status() === 404) {
                $execution->update([
                    'status' => ExecutionStatus::RemoteMissing,
                    'message' => $exception->response->json('description') ?? 'Remote job is missing.',
                    'failed_at' => now(),
                    'last_polled_at' => now(),
                ]);

                return;
            }

            throw $exception;
        }

        $status = $this->statusFromRemote((string) ($job['status'] ?? 'running'));

        $execution->update([
            'status' => $status,
            'progress' => (int) ($job['progress'] ?? $execution->progress),
            'message' => $job['message'] ?? $execution->message,
            'remote_created_at' => $this->parseRemoteDate($job['created'] ?? null),
            'remote_started_at' => $this->parseRemoteDate($job['started'] ?? null),
            'remote_finished_at' => $this->parseRemoteDate($job['finished'] ?? null),
            'last_polled_at' => now(),
            'completed_at' => $status === ExecutionStatus::Successful ? now() : $execution->completed_at,
            'failed_at' => $status === ExecutionStatus::Failed ? now() : $execution->failed_at,
        ]);

        $execution->refresh();

        if ($execution->status === ExecutionStatus::Successful) {
            $resultLink = collect($job['links'] ?? [])
                ->first(fn (array $link): bool => str_contains((string) ($link['rel'] ?? ''), 'results'));

            if (is_array($resultLink) && $this->shouldDeferResultDownload($resultLink)) {
                $this->storeProcessResult->fromLink($execution, $resultLink);
            } else {
                $this->storeProcessResult->fromResponse($execution, $this->client->jobResults($execution->remote_job_id));
            }

            $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());

            return;
        }

        if ($execution->status === ExecutionStatus::Failed) {
            $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());

            return;
        }

        PollProcessExecutionJob::dispatch($execution->id)->delay(now()->addSeconds(10));
    }

    private function statusFromRemote(string $status): ExecutionStatus
    {
        return match ($status) {
            'accepted' => ExecutionStatus::Accepted,
            'running' => ExecutionStatus::Running,
            'successful' => ExecutionStatus::Successful,
            'failed' => ExecutionStatus::Failed,
            default => ExecutionStatus::Running,
        };
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

    private function parseRemoteDate(?string $date): ?CarbonImmutable
    {
        return filled($date) ? CarbonImmutable::parse($date) : null;
    }
}
