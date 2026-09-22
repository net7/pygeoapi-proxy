<?php

namespace App\Http\Controllers\Ogc;

use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Services\Ogc\ProcessExecutionStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use RuntimeException;

class ProcessExecutionStorageController extends Controller
{
    public function __invoke(
        ProcessExecution $processExecution,
        ProcessExecutionStorage $storage,
    ): JsonResponse {
        Gate::authorize('viewStorage', $processExecution);

        try {
            return response()->json($storage->forExecution($processExecution))
                ->header('Cache-Control', 'private, no-store');
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json(['message' => 'Unable to inspect job storage.'], 503)
                ->header('Cache-Control', 'private, no-store');
        }
    }
}
