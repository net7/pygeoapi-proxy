<?php

namespace App\Http\Controllers\Ogc;

use App\Enums\Ogc\MapLayerStatus;
use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\GeoServerClient;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class ProcessExecutionResultMapTileController extends Controller
{
    public function __invoke(
        Request $request,
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        GeoServerClient $geoServer,
    ): Response {
        Gate::authorize('view', $processExecution);

        abort_unless($result->process_execution_id === $processExecution->id, 404);
        abort_unless($result->map_layer_type === 'wms', 404);
        abort_unless($result->map_layer_status === MapLayerStatus::Published, 404);
        abort_unless(filled($result->map_layer_name), 404);

        $validated = Validator::make($request->query(), [
            'bbox' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value) || ! $this->isValidBbox($value)) {
                        $fail(__('validation.invalid', ['attribute' => $attribute]));
                    }
                },
            ],
            'width' => ['nullable', 'integer', 'min:1', 'max:1024'],
            'height' => ['nullable', 'integer', 'min:1', 'max:1024'],
        ])->validate();

        $tileResponse = $geoServer->getPngTile($result->map_layer_name, [
            'bbox' => $validated['bbox'],
            'width' => (int) ($validated['width'] ?? 256),
            'height' => (int) ($validated['height'] ?? 256),
        ]);

        abort_unless($tileResponse->successful(), 502);

        return response($tileResponse->body(), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'private, max-age=60',
        ]);
    }

    private function isValidBbox(string $bbox): bool
    {
        $parts = explode(',', $bbox);

        if (count($parts) !== 4) {
            return false;
        }

        foreach ($parts as $part) {
            $value = filter_var(trim($part), FILTER_VALIDATE_FLOAT);

            if ($value === false || ! is_finite((float) $value)) {
                return false;
            }
        }

        return true;
    }
}
