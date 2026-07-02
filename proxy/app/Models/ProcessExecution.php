<?php

namespace App\Models;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use Database\Factories\ProcessExecutionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'name',
    'process_id',
    'process_title',
    'process_version',
    'execution_mode',
    'remote_job_id',
    'status',
    'progress',
    'message',
    'note',
    'note_updated_at',
    'request_payload',
    'requested_outputs',
    'process_outputs',
    'remote_created_at',
    'remote_started_at',
    'remote_finished_at',
    'last_polled_at',
    'submitted_at',
    'completed_at',
    'failed_at',
])]
class ProcessExecution extends Model
{
    /** @use HasFactory<ProcessExecutionFactory> */
    use HasFactory;

    public function displayName(): string
    {
        $name = trim((string) $this->name);

        if ($name !== '') {
            return $name;
        }

        $processName = $this->process_title ?: $this->process_id;
        $createdAt = $this->created_at?->timezone((string) config('app.timezone'))->format('d/m/Y H:i');

        return trim("{$processName} {$createdAt}");
    }

    /**
     * @return BelongsTo<User, ProcessExecution>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<ProcessExecutionResult>
     */
    public function results(): HasMany
    {
        return $this->hasMany(ProcessExecutionResult::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'execution_mode' => ExecutionMode::class,
            'status' => ExecutionStatus::class,
            'note' => 'array',
            'request_payload' => 'array',
            'requested_outputs' => 'array',
            'process_outputs' => 'array',
            'note_updated_at' => 'datetime',
            'remote_created_at' => 'datetime',
            'remote_started_at' => 'datetime',
            'remote_finished_at' => 'datetime',
            'last_polled_at' => 'datetime',
            'submitted_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
