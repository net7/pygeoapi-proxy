<?php

namespace App\Http\Controllers\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessExecutionResultController extends Controller
{
    public function download(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): Response {
        $this->authorizeResult($processExecution, $result);
        $this->ensureResultFileIsCached($processExecution, $result, $client);

        if (blank($result->storage_path)) {
            return $this->previewJsonResponse($result);
        }

        return $this->fileResponse($result, 'attachment');
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
        $path = "ogc-results/{$processExecution->id}/".$this->resultFileName($result);
        $mediaType = Str::of((string) $remoteResponse->header('Content-Type'))
            ->trim()
            ->lower()
            ->toString();

        Storage::disk('local')->put($path, $body);

        $result->update([
            'media_type' => $mediaType ?: $result->media_type,
            'storage_path' => $path,
            'size_bytes' => strlen($body),
            'cache_status' => ResultCacheStatus::Cached,
        ]);
    }

    private function fileResponse(ProcessExecutionResult $result, string $disposition): Response
    {
        return response(Storage::disk('local')->get($result->storage_path), 200, [
            'Content-Type' => $result->media_type ?: 'application/octet-stream',
            'Content-Disposition' => "{$disposition}; filename=\"".$this->resultFileName($result).'"',
        ]);
    }

    private function previewJsonResponse(ProcessExecutionResult $result): Response
    {
        $previewKind = data_get($result->preview, 'kind');
        $previewData = data_get($result->preview, 'data');

        abort_unless(
            in_array($previewKind, ['chart', 'json'], true)
                && ($result->media_type === 'application/json' || str_ends_with((string) $result->media_type, '+json')),
            404,
        );

        return response(json_encode($previewData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), 200, [
            'Content-Type' => $result->media_type ?: 'application/json',
            'Content-Disposition' => 'attachment; filename="'.$this->resultFileName($result, 'json').'"',
        ]);
    }

    private function resultFileName(ProcessExecutionResult $result, ?string $extension = null): string
    {
        $fileName = Str::of($result->output_id)
            ->replaceMatches('/[^A-Za-z0-9._-]+/', '_')
            ->trim('._-')
            ->toString();

        $fileName = $fileName !== '' ? $fileName : "result-{$result->id}";

        if ($extension !== null && ! str_ends_with($fileName, ".{$extension}")) {
            return "{$fileName}.{$extension}";
        }

        return $fileName;
    }
}
