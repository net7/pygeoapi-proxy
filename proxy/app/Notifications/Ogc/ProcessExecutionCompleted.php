<?php

namespace App\Notifications\Ogc;

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
            'process_execution_id' => $this->execution->id,
            'process_id' => $this->execution->process_id,
            'process_title' => $this->execution->process_title,
            'status' => $this->execution->status->value,
            'message' => $this->execution->message,
        ]);
    }
}
