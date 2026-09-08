<?php

namespace App\Http\Controllers\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\OgcProcessesClient;
use App\Support\Ogc\ResultFileName;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessExecutionResultController extends Controller
{
    public function preview(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): Response {
        $this->authorizeResult($processExecution, $result);
        abort_unless($this->isPreviewableImageMediaType($result->media_type), 404);

        $this->ensureResultFileIsCached($processExecution, $result, $client);
        $result->refresh();

        abort_unless(
            filled($result->storage_path)
            && $this->isPreviewableImageMediaType($result->media_type),
            404,
        );

        return $this->fileResponse($processExecution, $result, 'inline');
    }

    public function download(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): Response {
        $this->authorizeResult($processExecution, $result);
        $this->ensureResultFileIsCached($processExecution, $result, $client);

        if (blank($result->storage_path)) {
            return $this->previewResponse($processExecution, $result);
        }

        return $this->fileResponse($processExecution, $result, 'attachment');
    }

    private function authorizeResult(ProcessExecution $processExecution, ProcessExecutionResult $result): void
    {
        Gate::authorize('view', $processExecution);

        abort_unless($result->process_execution_id === $processExecution->id, 404);
    }

    private function ensureResultFileIsCached(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): void {
        if (filled($result->storage_path) || blank($result->remote_href)) {
            return;
        }

        $remoteResponse = $client->downloadResultUrl($result->remote_href);
        $body = $remoteResponse->body();
        $mediaType = Str::of((string) $remoteResponse->header('Content-Type'))
            ->trim()
            ->lower()
            ->toString();
        $path = "ogc-results/{$processExecution->id}/".ResultFileName::forOutput(
            $processExecution,
            $result->output_id,
            $mediaType ?: $result->media_type,
        );

        Storage::disk('local')->put($path, $body);

        $result->update([
            'media_type' => $mediaType ?: $result->media_type,
            'storage_path' => $path,
            'size_bytes' => strlen($body),
            'cache_status' => ResultCacheStatus::Cached,
        ]);
    }

    private function fileResponse(ProcessExecution $processExecution, ProcessExecutionResult $result, string $disposition): Response
    {
        return response(Storage::disk('local')->get($result->storage_path), 200, [
            'Content-Type' => $result->media_type ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition' => "{$disposition}; filename=\"".ResultFileName::forOutput(
                $processExecution,
                $result->output_id,
                $result->media_type,
            ).'"',
        ]);
    }

    private function previewResponse(ProcessExecution $processExecution, ProcessExecutionResult $result): Response
    {
        $previewKind = data_get($result->preview, 'kind');
        $previewData = data_get($result->preview, 'data');
        $mediaType = $this->baseMediaType($result->media_type);

        if (in_array($previewKind, ['chart', 'json'], true) && $this->isJsonMediaType($mediaType)) {
            return $this->previewJsonResponse($processExecution, $result, $previewData);
        }

        if ($previewKind === 'csv' && $mediaType === 'text/csv') {
            return $this->previewTextResponse(
                $processExecution,
                $result,
                $this->previewTextData($previewData),
                'csv',
            );
        }

        if ($previewKind === 'text' && $mediaType === 'text/plain') {
            return $this->previewTextResponse($processExecution, $result, $previewData, 'txt');
        }

        abort(404);
    }

    private function previewJsonResponse(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        mixed $previewData,
    ): Response {
        return response(json_encode($previewData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), 200, [
            'Content-Type' => $result->media_type ?: 'application/json',
            'Content-Disposition' => 'attachment; filename="'.ResultFileName::forOutput(
                $processExecution,
                $result->output_id,
                $result->media_type,
                'json',
            ).'"',
        ]);
    }

    private function previewTextData(mixed $previewData): mixed
    {
        if (is_array($previewData) && array_key_exists('source', $previewData)) {
            return $previewData['source'];
        }

        return $previewData;
    }

    private function previewTextResponse(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        mixed $previewData,
        string $extension,
    ): Response {
        abort_unless(is_scalar($previewData) || $previewData === null, 404);

        return response((string) $previewData, 200, [
            'Content-Type' => $result->media_type ?: 'text/plain',
            'Content-Disposition' => 'attachment; filename="'.ResultFileName::forOutput(
                $processExecution,
                $result->output_id,
                $result->media_type,
                $extension,
            ).'"',
        ]);
    }

    private function baseMediaType(?string $mediaType): string
    {
        return Str::of((string) $mediaType)
            ->before(';')
            ->trim()
            ->lower()
            ->toString();
    }

    private function isJsonMediaType(string $mediaType): bool
    {
        return $mediaType === 'application/json' || str_ends_with($mediaType, '+json');
    }

    private function isPreviewableImageMediaType(?string $mediaType): bool
    {
        return in_array($this->baseMediaType($mediaType), [
            'image/gif',
            'image/jpeg',
            'image/png',
            'image/webp',
        ], true);
    }
}
