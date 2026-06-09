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
        Gate::authorize('view', $processExecution);

        abort_unless($result->process_execution_id === $processExecution->id, 404);

        if (blank($result->storage_path) && filled($result->remote_href)) {
            $remoteResponse = $client->downloadResultUrl($result->remote_href);
            $body = $remoteResponse->body();
            $path = "ogc-results/{$processExecution->id}/".$this->resultFileName($result);
            $mediaType = Str::of((string) $remoteResponse->header('Content-Type'))
                ->before(';')
                ->trim()
                ->toString();

            Storage::disk('local')->put($path, $body);

            $result->update([
                'media_type' => $mediaType ?: $result->media_type,
                'storage_path' => $path,
                'size_bytes' => strlen($body),
                'cache_status' => ResultCacheStatus::Cached,
            ]);
        }

        abort_unless(filled($result->storage_path), 404);

        return response(Storage::disk('local')->get($result->storage_path), 200, [
            'Content-Type' => $result->media_type ?: 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="'.$this->resultFileName($result).'"',
        ]);
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
