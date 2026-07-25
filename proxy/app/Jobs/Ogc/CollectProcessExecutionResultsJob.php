<?php

namespace App\Jobs\Ogc;

use App\Actions\Ogc\CollectProcessExecutionResults;
use App\Enums\Ogc\ExecutionStatus;
use App\Enums\Ogc\ResultCollectionStatus;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

class CollectProcessExecutionResultsJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public int $processExecutionId) {}

    public function handle(CollectProcessExecutionResults $collectProcessExecutionResults): void
    {
        $execution = ProcessExecution::find($this->processExecutionId);

        if ($execution === null) {
            return;
        }

        $collectProcessExecutionResults->handle($execution);
    }

    public function failed(?Throwable $exception): void
    {
        $execution = ProcessExecution::find($this->processExecutionId);

        if (
            $execution === null
            || $execution->status !== ExecutionStatus::Successful
            || $execution->result_collection_status === ResultCollectionStatus::Successful
        ) {
            return;
        }

        $execution->update([
            'result_collection_status' => ResultCollectionStatus::Failed,
            'result_collection_error' => $exception?->getMessage() ?? 'Result collection failed.',
        ]);
        $execution->refresh();

        $execution->user->notify((new ProcessExecutionCompleted($execution))->afterCommit());
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("process-execution-results-{$this->processExecutionId}"))
                ->expireAfter(300),
        ];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 60];
    }
}
