<?php

namespace App\Http\Controllers\Ogc;

use App\Actions\Ogc\CreateProcessExecution;
use App\Actions\Ogc\DeleteProcessExecution;
use App\Http\Controllers\Controller;
use App\Http\Requests\Ogc\BulkDestroyProcessExecutionRequest;
use App\Http\Requests\Ogc\StoreProcessExecutionRequest;
use App\Http\Requests\Ogc\UpdateProcessExecutionNameRequest;
use App\Http\Requests\Ogc\UpdateProcessExecutionNoteRequest;
use App\Jobs\Ogc\SubmitProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\ProcessInputValidator;
use App\Services\Ogc\ProcessOutputRequestBuilder;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProcessExecutionController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);
        $includeRemoteJobId = $user->isAdmin();

        return Inertia::render('process-executions/index', [
            'pollingInterval' => $this->pollingInterval(),
            'executions' => $user
                ->processExecutions()
                ->latest()
                ->paginate(15)
                ->through(fn (ProcessExecution $execution): array => $this->executionListItem($execution, $includeRemoteJobId)),
        ]);
    }

    public function store(
        StoreProcessExecutionRequest $request,
        string $process,
        OgcProcessCache $cache,
        ProcessSchemaNormalizer $schemaNormalizer,
        ProcessInputValidator $inputValidator,
        ProcessOutputRequestBuilder $outputRequestBuilder,
        CreateProcessExecution $createProcessExecution,
    ): RedirectResponse {
        $user = $request->user();
        assert($user instanceof User);

        $processDescription = $cache->process($process);

        abort_if($processDescription === null, 409, 'Process description is still warming up.');

        $inputErrors = $inputValidator->errors(
            $schemaNormalizer->normalize($processDescription)['fields'],
            $request->executionInputs(),
        );

        if ($inputErrors !== []) {
            throw ValidationException::withMessages($inputErrors);
        }

        $payload = [
            'inputs' => $request->executionInputs(),
            'outputs' => $outputRequestBuilder->forProcess($processDescription),
        ];
        $mode = $request->executionMode();

        $execution = $createProcessExecution->handle(
            user: $user,
            process: $processDescription,
            payload: $payload,
            mode: $mode,
            note: $request->note(),
            name: $request->processName(),
        );

        SubmitProcessExecutionJob::dispatch($execution->id, $payload);

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Process queued'),
            'message' => __('The process has been queued.'),
            'description' => __('A local job was created and the remote submission has started.'),
            'icon' => false,
            'details' => [
                [
                    'label' => __('Process'),
                    'value' => $execution->process_title ?? $execution->process_id,
                ],
                [
                    'label' => __('Local job'),
                    'value' => "#{$execution->id}",
                ],
                [
                    'label' => __('Mode'),
                    'value' => $mode->value,
                ],
                [
                    'label' => __('Initial status'),
                    'value' => $execution->status->value,
                ],
            ],
            'note' => __('Remote submission is running in the background. This page will update automatically.'),
        ]);

        return redirect()->route('jobs.show', $execution);
    }

    public function show(Request $request, ProcessExecution $processExecution): Response
    {
        Gate::authorize('view', $processExecution);

        $user = $request->user();
        assert($user instanceof User);

        $processExecution->load('results');

        $includeAdminData = $user->isAdmin();
        $execution = [
            ...$this->executionListItem($processExecution, $includeAdminData),
            'processVersion' => $processExecution->process_version,
            'note' => $processExecution->note,
            'noteUpdatedAt' => $processExecution->note_updated_at?->toIso8601String(),
            'requestedOutputs' => $processExecution->requested_outputs,
            'results' => $processExecution->results->map(fn ($result): array => [
                'id' => $result->id,
                'outputId' => $result->output_id,
                'title' => $result->title,
                'description' => $result->description,
                'mediaType' => $result->media_type,
                'cacheStatus' => $result->cache_status->value,
                'preview' => $result->preview,
                'mapLayer' => [
                    'type' => $result->map_layer_type,
                    'status' => $result->map_layer_status?->value,
                    'name' => $result->map_layer_name,
                    'styleName' => $result->map_style_name,
                    'bounds' => $result->map_layer_bounds,
                    'publishedAt' => $result->map_layer_published_at?->toIso8601String(),
                    'error' => $result->map_layer_error,
                ],
            ])->all(),
        ];

        if ($includeAdminData) {
            $execution['requestPayload'] = $processExecution->request_payload;
        }

        return Inertia::render('process-executions/show', [
            'pollingInterval' => $this->pollingInterval(),
            'execution' => $execution,
        ]);
    }

    public function updateName(UpdateProcessExecutionNameRequest $request, ProcessExecution $processExecution): RedirectResponse
    {
        Gate::authorize('update', $processExecution);

        $processExecution->forceFill([
            'name' => $request->processName(),
        ])->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Process name saved'),
            'message' => __('The process name has been saved.'),
            'icon' => false,
        ]);

        return back();
    }

    public function updateNote(UpdateProcessExecutionNoteRequest $request, ProcessExecution $processExecution): RedirectResponse
    {
        Gate::authorize('update', $processExecution);

        $note = $request->note();

        $processExecution->forceFill([
            'note' => $note,
            'note_updated_at' => $note === null && $processExecution->note === null ? null : now(),
        ])->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Note saved'),
            'message' => __('The job note has been saved.'),
            'icon' => false,
        ]);

        return back();
    }

    public function destroy(
        Request $request,
        ProcessExecution $processExecution,
        DeleteProcessExecution $deleteProcessExecution,
    ): RedirectResponse {
        Gate::authorize('delete', $processExecution);

        $processLabel = $processExecution->process_title ?? $processExecution->process_id;
        $localJobId = $processExecution->id;

        try {
            $deleteProcessExecution->handle($processExecution);
        } catch (ConnectionException|RequestException $exception) {
            report($exception);

            Inertia::flash('toast', [
                'type' => 'error',
                'title' => __('Job could not be deleted'),
                'message' => __('The remote service did not confirm deletion.'),
                'description' => __('The job is still available. Please try again later.'),
                'icon' => false,
            ]);

            return back();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Job deleted'),
            'message' => __('The job has been deleted.'),
            'description' => __('The local job and its saved results were removed.'),
            'icon' => false,
            'details' => [
                [
                    'label' => __('Process'),
                    'value' => $processLabel,
                ],
                [
                    'label' => __('Local job'),
                    'value' => "#{$localJobId}",
                ],
            ],
        ]);

        if ($request->string('redirect')->toString() === 'back') {
            return back();
        }

        return to_route('jobs.index');
    }

    public function bulkDestroy(
        BulkDestroyProcessExecutionRequest $request,
        DeleteProcessExecution $deleteProcessExecution,
    ): RedirectResponse {
        $ids = $request->executionIds();
        $executions = ProcessExecution::query()
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');
        $deletedCount = 0;

        try {
            foreach ($ids as $id) {
                /** @var ProcessExecution $execution */
                $execution = $executions->get($id);

                Gate::authorize('delete', $execution);

                $deleteProcessExecution->handle($execution);
                $deletedCount++;
            }
        } catch (ConnectionException|RequestException $exception) {
            report($exception);

            Inertia::flash('toast', [
                'type' => 'error',
                'title' => __('Jobs could not be deleted'),
                'message' => __('The remote service did not confirm deletion.'),
                'description' => __('Some selected jobs may still be available. Refresh and try again later.'),
                'icon' => false,
            ]);

            return back();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Jobs deleted'),
            'message' => __('The selected jobs have been deleted.'),
            'icon' => false,
            'details' => [
                [
                    'label' => __('Deleted jobs'),
                    'value' => (string) $deletedCount,
                ],
            ],
        ]);

        return back();
    }

    private function pollingInterval(): int
    {
        return max(1000, (int) config('services.ogc_processes.polling_interval', 5000));
    }

    /**
     * @return array<string, mixed>
     */
    private function executionListItem(ProcessExecution $execution, bool $includeRemoteJobId): array
    {
        $payload = [
            'id' => $execution->id,
            'name' => $execution->name,
            'displayName' => $execution->displayName(),
            'processId' => $execution->process_id,
            'processTitle' => $execution->process_title,
            'status' => $execution->status->value,
            'progress' => $execution->progress,
            'message' => $execution->message,
            'createdAt' => $execution->created_at?->toIso8601String(),
            'submittedAt' => $execution->submitted_at?->toIso8601String(),
            'completedAt' => $execution->completed_at?->toIso8601String(),
            'failedAt' => $execution->failed_at?->toIso8601String(),
        ];

        if ($includeRemoteJobId) {
            $payload['remoteJobId'] = $execution->remote_job_id;
        }

        return $payload;
    }
}
