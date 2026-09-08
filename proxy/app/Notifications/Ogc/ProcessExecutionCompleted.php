<?php

namespace App\Notifications\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Enums\Ogc\ResultCollectionStatus;
use App\Models\ProcessExecution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class ProcessExecutionCompleted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ProcessExecution $execution) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): DatabaseMessage
    {
        return new DatabaseMessage([
            'title' => $this->title(),
            'body' => $this->body(),
            'icon' => $this->icon(),
            'tone' => $this->tone(),
            'action_url' => route('jobs.show', $this->execution),
            'process_execution_id' => $this->execution->id,
            'process_id' => $this->execution->process_id,
            'process_title' => $this->execution->process_title,
            'status' => $this->execution->status->value,
            'message' => $this->execution->message,
        ]);
    }

    private function title(): string
    {
        return match ($this->execution->status) {
            ExecutionStatus::Successful => __('Process completed'),
            ExecutionStatus::Failed => __('Process failed'),
            default => __('Process updated'),
        };
    }

    private function body(): string
    {
        if ($this->hasResultCollectionFailure()) {
            return __('The process finished successfully, but the results could not be collected. You can retry from the job page.');
        }

        if ($this->execution->status === ExecutionStatus::Successful) {
            return __('The process finished successfully and the results are ready.');
        }

        if ($this->execution->status === ExecutionStatus::Failed) {
            return __('The process failed: :message', [
                'message' => $this->execution->message ?? __('No details were returned.'),
            ]);
        }

        return $this->execution->message ?? __('The process status has changed.');
    }

    private function icon(): string
    {
        if ($this->hasResultCollectionFailure()) {
            return 'circle-alert';
        }

        return match ($this->execution->status) {
            ExecutionStatus::Successful => 'check-circle',
            ExecutionStatus::Failed => 'circle-alert',
            default => 'info',
        };
    }

    private function tone(): string
    {
        if ($this->hasResultCollectionFailure()) {
            return 'warning';
        }

        return match ($this->execution->status) {
            ExecutionStatus::Successful => 'success',
            ExecutionStatus::Failed => 'error',
            default => 'info',
        };
    }

    private function hasResultCollectionFailure(): bool
    {
        return $this->execution->status === ExecutionStatus::Successful
            && $this->execution->result_collection_status === ResultCollectionStatus::Failed;
    }
}
