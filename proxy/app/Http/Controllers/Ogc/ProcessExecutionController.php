<?php

namespace App\Http\Controllers\Ogc;

use App\Actions\Ogc\CreateProcessExecution;
use App\Actions\Ogc\DeleteProcessExecution;
use App\Actions\Ogc\FindGeoTiffSldResultPairs;
use App\Http\Controllers\Controller;
use App\Http\Requests\Ogc\BulkDestroyProcessExecutionRequest;
use App\Http\Requests\Ogc\StoreProcessExecutionRequest;
use App\Http\Requests\Ogc\UpdateProcessExecutionNameRequest;
use App\Http\Requests\Ogc\UpdateProcessExecutionNoteRequest;
use App\Jobs\Ogc\SubmitProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use App\Services\Ogc\CsvPreviewBuilder;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\OgcTextNormalizer;
use App\Services\Ogc\ProcessExecutionInputReview;
use App\Services\Ogc\ProcessInputPayloadBuilder;
use App\Services\Ogc\ProcessInputValidator;
use App\Services\Ogc\ProcessInputValueNormalizer;
use App\Services\Ogc\ProcessOutputRequestBuilder;
use App\Services\Ogc\ProcessSchemaNormalizer;
use App\Support\Ogc\SldVisualizationInspector;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
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
        ProcessInputValueNormalizer $inputValueNormalizer,
        ProcessInputPayloadBuilder $inputPayloadBuilder,
        ProcessOutputRequestBuilder $outputRequestBuilder,
        CreateProcessExecution $createProcessExecution,
    ): RedirectResponse {
        $user = $request->user();
        assert($user instanceof User);

        $processDescription = $cache->process($process);

        abort_if($processDescription === null, 409, 'Process description is still warming up.');

        $fields = $schemaNormalizer->normalize($processDescription)['fields'];
        $submittedInputs = $inputValueNormalizer->normalize(
            $fields,
            $request->executionInputs(),
        );
        $inputErrors = $inputValidator->errors($fields, $submittedInputs);

        if ($inputErrors !== []) {
            throw ValidationException::withMessages($inputErrors);
        }

        $executionInputs = $inputPayloadBuilder->build(
            $fields,
            $submittedInputs,
        );

        $payload = [
            'inputs' => $executionInputs,
            'outputs' => $outputRequestBuilder->forProcess(
                $processDescription,
                $request->outputSelection(),
            ),
        ];
        $mode = $request->executionMode();

        $execution = $createProcessExecution->handle(
            user: $user,
            process: $processDescription,
            payload: $payload,
            mode: $mode,
            note: $request->note(),
            name: $request->processName(),
            submittedInputs: $submittedInputs,
            inputFiles: $request->inputFiles(),
        );

        SubmitProcessExecutionJob::dispatch($execution->id, $payload);

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Process started'),
            'message' => __('The process is running.'),
            'icon' => false,
        ]);

        return redirect()->route('jobs.show', $execution);
    }

    public function show(
        Request $request,
        ProcessExecution $processExecution,
        FindGeoTiffSldResultPairs $findGeoTiffSldResultPairs,
        SldVisualizationInspector $sldVisualizationInspector,
        CsvPreviewBuilder $csvPreviewBuilder,
        OgcTextNormalizer $textNormalizer,
        ProcessExecutionInputReview $inputReview,
    ): Response {
        Gate::authorize('view', $processExecution);

        $user = $request->user();
        assert($user instanceof User);

        $processExecution->load('results');

        $includeAdminData = $user->isAdmin();
        $showMapLayerWarnings = $includeAdminData
            && (bool) config(
                'services.ogc_processes.show_map_layer_warnings',
                false,
            );
        $mapLayerWarnings = $showMapLayerWarnings
            ? $this->mapLayerWarnings(
                $processExecution,
                $findGeoTiffSldResultPairs,
                $sldVisualizationInspector,
            )
            : [];
        $execution = [
            ...$this->executionListItem($processExecution, $includeAdminData),
            'processVersion' => $processExecution->process_version,
            'note' => $processExecution->note,
            'noteUpdatedAt' => $processExecution->note_updated_at?->toIso8601String(),
            'requestedOutputs' => $processExecution->requested_outputs,
            'outputMetadata' => (object) $this->outputMetadata($processExecution, $textNormalizer),
            'resultCollection' => [
                'status' => $processExecution->result_collection_status?->value,
                'error' => $includeAdminData
                    ? $processExecution->result_collection_error
                    : null,
            ],
            'results' => $processExecution->results->map(fn (ProcessExecutionResult $result): array => [
                'id' => $result->id,
                'outputId' => $result->output_id,
                'title' => $textNormalizer->normalize($result->title),
                'description' => $textNormalizer->normalize($result->description),
                'mediaType' => $result->media_type,
                'cacheStatus' => $result->cache_status->value,
                'preview' => $this->previewForResult($result, $csvPreviewBuilder),
                'mapLayer' => [
                    'type' => $result->map_layer_type,
                    'status' => $result->map_layer_status?->value,
                    'name' => $result->map_layer_name,
                    'styleName' => $result->map_style_name,
                    'bounds' => $result->map_layer_bounds,
                    'publishedAt' => $result->map_layer_published_at?->toIso8601String(),
                    'error' => $result->map_layer_error,
                    'warning' => $mapLayerWarnings[$result->id] ?? null,
                ],
            ])->all(),
        ];

        if ($includeAdminData) {
            $execution['requestPayload'] = $processExecution->request_payload;
        }

        return Inertia::render('process-executions/show', [
            'pollingInterval' => $this->pollingInterval(),
            'execution' => $execution,
            'inputReview' => fn (): array => $inputReview->forExecution($processExecution),
        ]);
    }

    /**
     * @return array<string, array{
     *     title: string,
     *     description: string|null
     * }>
     */
    private function outputMetadata(
        ProcessExecution $processExecution,
        OgcTextNormalizer $textNormalizer,
    ): array {
        $metadata = [];

        foreach ($processExecution->process_outputs ?? [] as $outputId => $output) {
            if (! is_array($output)) {
                continue;
            }

            $title = is_string($output['title'] ?? null)
                ? $textNormalizer->normalize($output['title'])
                : null;
            $description = is_string($output['description'] ?? null)
                ? $textNormalizer->normalize($output['description'])
                : null;

            $metadata[(string) $outputId] = [
                'title' => is_string($title) && trim($title) !== ''
                    ? $title
                    : (string) $outputId,
                'description' => is_string($description)
                    && trim($description) !== ''
                        ? $description
                        : null,
            ];
        }

        return $metadata;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function previewForResult(ProcessExecutionResult $result, CsvPreviewBuilder $csvPreviewBuilder): ?array
    {
        $preview = $result->preview;

        if (! $this->isCsvResult($result)) {
            return $preview;
        }

        if ($this->hasStructuredCsvPreview($preview)) {
            return $preview;
        }

        if (blank($result->storage_path) || ! Storage::disk('local')->exists((string) $result->storage_path)) {
            return $preview;
        }

        return [
            'kind' => 'csv',
            'data' => $csvPreviewBuilder->fromString(
                Storage::disk('local')->get((string) $result->storage_path),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $preview
     */
    private function hasStructuredCsvPreview(?array $preview): bool
    {
        $data = data_get($preview, 'data');

        return data_get($preview, 'kind') === 'csv'
            && is_array($data)
            && is_array($data['headers'] ?? null)
            && is_array($data['rows'] ?? null);
    }

    private function baseMediaType(?string $mediaType): string
    {
        return str((string) $mediaType)
            ->before(';')
            ->trim()
            ->lower()
            ->toString();
    }

    private function isCsvResult(ProcessExecutionResult $result): bool
    {
        $mediaType = $this->baseMediaType($result->media_type);

        return $mediaType === 'text/csv'
            || str($mediaType)->contains('csv')
            || $this->looksLikeCsvPath($result->storage_path)
            || $this->looksLikeCsvPath($result->remote_href);
    }

    private function looksLikeCsvPath(?string $path): bool
    {
        return str((string) $path)
            ->before('?')
            ->lower()
            ->endsWith('.csv');
    }

    /**
     * @return array<int, string|null>
     */
    private function mapLayerWarnings(
        ProcessExecution $processExecution,
        FindGeoTiffSldResultPairs $findGeoTiffSldResultPairs,
        SldVisualizationInspector $sldVisualizationInspector,
    ): array {
        return $findGeoTiffSldResultPairs
            ->handle($processExecution)
            ->mapWithKeys(fn (array $pair): array => [
                $pair['geotiff']->id => $sldVisualizationInspector->warningForResult($pair['sld']),
            ])
            ->all();
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
