<?php

namespace App\Jobs\Ogc;

use App\Actions\Ogc\SubmitProcessExecution;
use App\Models\ProcessExecution;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable as FoundationQueueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class SubmitProcessExecutionJob implements ShouldQueue
{
    use FoundationQueueable;

    public int $tries = 3;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public int $processExecutionId,
        public array $payload,
    ) {}

    public function handle(SubmitProcessExecution $submitProcessExecution): void
    {
        $execution = ProcessExecution::find($this->processExecutionId);

        if ($execution === null || $execution->status->isTerminal() || filled($execution->remote_job_id)) {
            return;
        }

        $submitProcessExecution->handle($execution, $this->payload);
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("process-execution-submit-{$this->processExecutionId}"))->expireAfter(180)];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [5, 10, 30];
    }
}
