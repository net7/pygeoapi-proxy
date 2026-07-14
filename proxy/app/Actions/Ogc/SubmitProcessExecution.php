<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Str;

class SubmitProcessExecution
{
    public function __construct(
        private OgcProcessesClient $client,
        private StoreProcessResult $storeProcessResult,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(ProcessExecution $execution, array $payload): ProcessExecution
    {
        if ($execution->status->isTerminal() || filled($execution->remote_job_id)) {
            return $execution->refresh();
        }

        try {
            $response = $this->client->execute($execution->process_id, $payload, $execution->execution_mode->preferHeader());
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
}
