<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Str;

class StartProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    /**
     * @param  array<string, mixed>  $process
     * @param  array<string, mixed>  $payload
     */
    public function handle(User $user, array $process, array $payload, ExecutionMode $mode): ProcessExecution
    {
        $execution = ProcessExecution::create([
            'user_id' => $user->id,
            'process_id' => (string) $process['id'],
            'process_title' => $process['title'] ?? $process['id'],
            'process_version' => $process['version'] ?? null,
            'execution_mode' => $mode,
            'status' => ExecutionStatus::Submitting,
            'progress' => 0,
            'request_payload' => $this->redactLargeInlineValues($payload),
            'requested_outputs' => $payload['outputs'] ?? null,
            'submitted_at' => now(),
        ]);

        try {
            $response = $this->client->execute((string) $process['id'], $payload, $mode->preferHeader());
        } catch (RequestException $exception) {
            $execution->update([
                'status' => ExecutionStatus::SubmissionFailed,
                'message' => $exception->response->json('description') ?? $exception->getMessage(),
                'failed_at' => now(),
            ]);

            return $execution->refresh();
        } catch (\Throwable $exception) {
            $execution->update([
                'status' => ExecutionStatus::SubmissionFailed,
                'message' => $exception->getMessage(),
                'failed_at' => now(),
            ]);

            return $execution->refresh();
        }

        if ($response->status() === 201) {
            $execution->update([
                'status' => ExecutionStatus::Accepted,
                'progress' => 5,
                'remote_job_id' => $this->jobIdFromLocation($response->header('Location')),
            ]);

            PollProcessExecutionJob::dispatch($execution->id)->delay(now()->addSeconds(5));

            return $execution->refresh();
        }

        $execution->update([
            'status' => ExecutionStatus::Successful,
            'progress' => 100,
            'completed_at' => now(),
        ]);

        $this->storeProcessResult->fromResponse($execution->refresh(), $response);

        return $execution->refresh()->load('results');
    }

    private function jobIdFromLocation(?string $location): ?string
    {
        if (! filled($location)) {
            return null;
        }

        return Str::of($location)->afterLast('/')->before('?')->toString();
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
