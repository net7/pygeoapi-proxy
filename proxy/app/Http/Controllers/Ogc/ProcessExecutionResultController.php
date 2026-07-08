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

        abort_unless(filled($result->storage_path), 404);

        return $this->fileResponse($result, 'attachment');
    }

    public function previewFile(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): Response {
        $this->authorizeResult($processExecution, $result);

        abort_unless($this->isMapPreviewResult($result), 404);

        $this->ensureResultFileIsCached($processExecution, $result, $client);

        abort_unless(filled($result->storage_path), 404);

        return $this->fileResponse($result, 'inline');
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

    private function isMapPreviewResult(ProcessExecutionResult $result): bool
    {
        $normalized = Str::of((string) $result->media_type)->trim()->lower()->toString();
        $baseMediaType = Str::of($normalized)->before(';')->trim()->toString();

        $isGeoTiff = in_array($baseMediaType, ['image/tiff', 'application/tiff'], true)
            && Str::of($result->output_id)->lower()->endsWith('.geotiff');

        return $isGeoTiff || $baseMediaType === 'application/vnd.ogc.sld+xml';
    }

    private function resultFileName(ProcessExecutionResult $result): string
    {
        $fileName = Str::of($result->output_id)
            ->replaceMatches('/[^A-Za-z0-9._-]+/', '_')
            ->trim('._-')
            ->toString();

        return $fileName !== '' ? $fileName : "result-{$result->id}";
    }
}
