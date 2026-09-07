<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Services\Ogc\ProcessExecutionInputSnapshot;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProcessExecutionInputController extends Controller
{
    public function __invoke(ProcessExecution $processExecution, int $file, ProcessExecutionInputSnapshot $snapshots): StreamedResponse
    {
        Gate::authorize('view', $processExecution);

        $snapshot = $processExecution->input_snapshot;

        if (is_array($snapshot)) {
            $metadata = $snapshot['files'][$file] ?? null;
            abort_unless(is_array($metadata), 404);
            $content = $snapshots->downloadContent($snapshot, $file);
        } else {
            $inputs = $processExecution->request_payload['inputs'] ?? [];
            $metadata = $snapshots->binaryFiles($inputs)[$file] ?? null;
            abort_unless(is_array($metadata), 404);
            $content = $snapshots->fileContent($inputs, $metadata['path']);
        }

        abort_if($content === null, 404);

        return response()->streamDownload(function () use ($content): void {
            echo $content;
        }, $metadata['name'], [
            'Content-Type' => 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
