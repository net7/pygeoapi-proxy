<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;

class CreateProcessExecution
{
    /**
     * @param  array<string, mixed>  $process
     * @param  array<string, mixed>  $payload
     */
    public function handle(User $user, array $process, array $payload, ExecutionMode $mode): ProcessExecution
    {
        return ProcessExecution::create([
            'user_id' => $user->id,
            'process_id' => (string) $process['id'],
            'process_title' => $process['title'] ?? $process['id'],
            'process_version' => $process['version'] ?? null,
            'execution_mode' => $mode,
            'status' => ExecutionStatus::Submitting,
            'progress' => 0,
            'request_payload' => $this->redactLargeInlineValues($payload),
            'requested_outputs' => $payload['outputs'] ?? null,
            'process_outputs' => $process['outputs'] ?? null,
            'submitted_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function redactLargeInlineValues(array $payload): array
    {
        $inputs = collect($payload['inputs'] ?? [])
            ->map(function (mixed $input): mixed {
                if (! is_array($input) || ! isset($input['value']) || ! is_string($input['value']) || strlen($input['value']) <= 2048) {
                    return $input;
                }

                return [
                    ...$input,
                    'value' => '[redacted inline value]',
                    'sizeBytes' => strlen($input['value']),
                ];
            })
            ->all();

        return [
            ...$payload,
            'inputs' => $inputs,
        ];
    }
}
