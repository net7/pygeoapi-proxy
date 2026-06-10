<?php

namespace App\Http\Controllers\Ogc;

use App\Actions\Ogc\StartProcessExecution;
use App\Http\Controllers\Controller;
use App\Http\Requests\Ogc\StoreProcessExecutionRequest;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProcessExecutionController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        return Inertia::render('process-executions/index', [
            'pollingInterval' => $this->pollingInterval(),
            'executions' => $user
                ->processExecutions()
                ->latest()
                ->paginate(15)
                ->through(fn (ProcessExecution $execution): array => [
                    'id' => $execution->id,
                    'remoteJobId' => $execution->remote_job_id,
                    'processId' => $execution->process_id,
                    'processTitle' => $execution->process_title,
                    'status' => $execution->status->value,
                    'progress' => $execution->progress,
                    'message' => $execution->message,
                    'createdAt' => $execution->created_at?->toIso8601String(),
                    'submittedAt' => $execution->submitted_at?->toIso8601String(),
                    'completedAt' => $execution->completed_at?->toIso8601String(),
                    'failedAt' => $execution->failed_at?->toIso8601String(),
                ]),
        ]);
    }

    public function store(
        StoreProcessExecutionRequest $request,
        string $process,
        OgcProcessesClient $client,
        StartProcessExecution $startProcessExecution,
    ): RedirectResponse {
        $user = $request->user();
        assert($user instanceof User);

        $execution = $startProcessExecution->handle(
            user: $user,
            process: $client->process($process),
            payload: $request->executionPayload(),
            mode: $request->executionMode(),
        );

        return redirect()->route('jobs.show', $execution);
    }

    public function show(ProcessExecution $processExecution): Response
    {
        Gate::authorize('view', $processExecution);

        $processExecution->load('results');

        return Inertia::render('process-executions/show', [
            'pollingInterval' => $this->pollingInterval(),
            'execution' => [
                'id' => $processExecution->id,
                'remoteJobId' => $processExecution->remote_job_id,
                'processId' => $processExecution->process_id,
                'processTitle' => $processExecution->process_title,
                'processVersion' => $processExecution->process_version,
                'status' => $processExecution->status->value,
                'progress' => $processExecution->progress,
                'message' => $processExecution->message,
                'requestPayload' => $processExecution->request_payload,
                'requestedOutputs' => $processExecution->requested_outputs,
                'createdAt' => $processExecution->created_at?->toIso8601String(),
                'submittedAt' => $processExecution->submitted_at?->toIso8601String(),
                'completedAt' => $processExecution->completed_at?->toIso8601String(),
                'failedAt' => $processExecution->failed_at?->toIso8601String(),
                'results' => $processExecution->results->map(fn ($result): array => [
                    'id' => $result->id,
                    'outputId' => $result->output_id,
                    'title' => $result->title,
                    'description' => $result->description,
                    'mediaType' => $result->media_type,
                    'cacheStatus' => $result->cache_status->value,
                    'preview' => $result->preview,
                ])->all(),
            ],
        ]);
    }

    private function pollingInterval(): int
    {
        return max(1000, (int) config('services.ogc_processes.polling_interval', 5000));
    }
}
