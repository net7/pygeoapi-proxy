<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Enums\Ogc\ResultCollectionStatus;
use App\Jobs\Ogc\CollectProcessExecutionResultsJob;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use App\Services\Ogc\OgcProcessesClient;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\RequestException;

class PollProcessExecution
{
    public function __construct(private OgcProcessesClient $client) {}

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
            'progress' => (int) ($job['progress'] ?? $execution->progress),
            'message' => $job['message'] ?? $execution->message,
            'remote_created_at' => $this->parseRemoteDate($job['created'] ?? null),
            'remote_started_at' => $this->parseRemoteDate($job['started'] ?? null),
            'remote_finished_at' => $this->parseRemoteDate($job['finished'] ?? null),
            'last_polled_at' => now(),
            ...($status === ExecutionStatus::Successful ? [] : [
                'status' => $status,
                'failed_at' => $status === ExecutionStatus::Failed ? now() : $execution->failed_at,
            ]),
        ]);

        $execution->refresh();

        if ($status === ExecutionStatus::Successful) {
            $execution->update([
                'status' => ExecutionStatus::Successful,
                'result_collection_status' => $execution->requested_outputs === []
                    ? ResultCollectionStatus::Successful
                    : ResultCollectionStatus::Pending,
                'result_collection_error' => null,
                'completed_at' => now(),
            ]);
            $execution->refresh();

            if ($execution->result_collection_status === ResultCollectionStatus::Successful) {
                $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());

                return;
            }

            CollectProcessExecutionResultsJob::dispatch($execution->id);

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

    private function parseRemoteDate(?string $date): ?CarbonImmutable
    {
        return filled($date) ? CarbonImmutable::parse($date) : null;
    }
}
