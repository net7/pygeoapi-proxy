<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\ProcessExecutionInputSnapshot;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Throwable;

class CreateProcessExecution
{
    public function __construct(
        private ProcessExecutionInputSnapshot $snapshots,
        private ProcessSchemaNormalizer $normalizer,
    ) {}

    /**
     * @param  array<string, mixed>  $process
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>|null  $note
     * @param  array<string, mixed>|null  $submittedInputs
     * @param  array<int, array{path: array<int, string>, name: string, content?: string|null, encoding?: string}>  $inputFiles
     */
    public function handle(User $user, array $process, array $payload, ExecutionMode $mode, ?array $note = null, ?string $name = null, ?array $submittedInputs = null, array $inputFiles = []): ProcessExecution
    {
        $snapshot = $this->snapshots->create(
            $this->normalizer->normalize($process)['fields'],
            $submittedInputs ?? $payload['inputs'] ?? [],
            $inputFiles,
        );

        try {
            return ProcessExecution::create([
                'user_id' => $user->id,
                'name' => $name,
                'process_id' => (string) $process['id'],
                'process_title' => $process['title'] ?? $process['id'],
                'process_version' => $process['version'] ?? null,
                'execution_mode' => $mode,
                'status' => ExecutionStatus::Submitting,
                'progress' => 0,
                'note' => $note,
                'note_updated_at' => $note === null ? null : now(),
                'request_payload' => $this->redactLargeInlineValues($payload),
                'input_snapshot' => $snapshot,
                'requested_outputs' => $payload['outputs'] ?? null,
                'process_outputs' => $process['outputs'] ?? null,
                'submitted_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $this->snapshots->delete($snapshot);

            throw $exception;
        }
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
