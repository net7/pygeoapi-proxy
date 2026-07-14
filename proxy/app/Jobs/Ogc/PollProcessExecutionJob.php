<?php

namespace App\Jobs\Ogc;

use App\Actions\Ogc\PollProcessExecution;
use App\Models\ProcessExecution;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable as FoundationQueueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class PollProcessExecutionJob implements ShouldQueue
{
    use FoundationQueueable;

    public int $tries = 20;

    public function __construct(public int $processExecutionId) {}

    public function handle(PollProcessExecution $pollProcessExecution): void
    {
        $execution = ProcessExecution::find($this->processExecutionId);

        if ($execution === null) {
            return;
        }

        $pollProcessExecution->handle($execution);
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [new WithoutOverlapping("process-execution-{$this->processExecutionId}")];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [5, 10, 30];
    }
}
