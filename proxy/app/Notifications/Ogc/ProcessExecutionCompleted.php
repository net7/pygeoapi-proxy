<?php

namespace App\Notifications\Ogc;

use App\Enums\Ogc\ExecutionStatus;
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
            'action_url' => route('process-executions.show', $this->execution),
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
        return match ($this->execution->status) {
            ExecutionStatus::Successful => 'check-circle',
            ExecutionStatus::Failed => 'circle-alert',
            default => 'info',
        };
    }

    private function tone(): string
    {
        return match ($this->execution->status) {
            ExecutionStatus::Successful => 'success',
            ExecutionStatus::Failed => 'error',
            default => 'info',
        };
    }
}
