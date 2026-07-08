<?php

namespace App\Jobs\Ogc;

use App\Enums\Ogc\MapLayerStatus;
use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\GeoServerClient;
use App\Support\Ogc\GeoServerName;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable as FoundationQueueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class PublishGeoTiffMapLayerJob implements ShouldQueue
{
    use FoundationQueueable;

    public int $tries = 3;

    public function __construct(
        public int $processExecutionId,
        public int $geoTiffResultId,
        public int $sldResultId,
    ) {}

    public function handle(GeoServerClient $geoServer): void
    {
        if (! (bool) config('geoserver.enabled', true)) {
            return;
        }

        $execution = ProcessExecution::query()
            ->with('results')
            ->find($this->processExecutionId);

        if (! $execution instanceof ProcessExecution) {
            return;
        }

        $geotiff = $this->resultFromExecution($execution, $this->geoTiffResultId);
        $sld = $this->resultFromExecution($execution, $this->sldResultId);

        if (! $geotiff instanceof ProcessExecutionResult || ! $sld instanceof ProcessExecutionResult) {
            return;
        }

        $layerName = GeoServerName::layer($execution, $geotiff);
        $styleName = GeoServerName::style($execution, $geotiff);

        try {
            $geoTiffPath = $this->localResultPath($geotiff, 'GeoTIFF');
            $sldPath = $this->localResultPath($sld, 'SLD');

            $geotiff->update([
                'map_layer_status' => MapLayerStatus::Publishing,
                'map_layer_type' => 'wms',
                'map_layer_name' => $layerName,
                'map_style_name' => $styleName,
                'map_layer_error' => null,
            ]);

            $geoServer->ensureWorkspace();
            $geoServer->publishGeoTiff($layerName, $layerName, $geoTiffPath);
            $geoServer->uploadStyle($styleName, $sldPath);
            $geoServer->assignDefaultStyle($layerName, $styleName);

            $geotiff->update([
                'map_layer_status' => MapLayerStatus::Published,
                'map_layer_type' => 'wms',
                'map_layer_name' => $layerName,
                'map_style_name' => $styleName,
                'map_layer_published_at' => now(),
                'map_layer_error' => null,
            ]);
        } catch (Throwable $exception) {
            $geotiff->update([
                'map_layer_status' => MapLayerStatus::Failed,
                'map_layer_type' => 'wms',
                'map_layer_name' => $layerName,
                'map_style_name' => $styleName,
                'map_layer_error' => Str::limit($exception->getMessage(), 2000, ''),
            ]);

            throw $exception;
        }
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping("geotiff-map-layer-{$this->geoTiffResultId}"))->expireAfter(300)];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [5, 30, 120];
    }

    private function resultFromExecution(ProcessExecution $execution, int $resultId): ?ProcessExecutionResult
    {
        $result = $execution->results->firstWhere('id', $resultId);

        return $result instanceof ProcessExecutionResult ? $result : null;
    }

    private function localResultPath(ProcessExecutionResult $result, string $label): string
    {
        if ($result->cache_status !== ResultCacheStatus::Cached || blank($result->storage_path)) {
            throw new \RuntimeException("{$label} result file is not cached.");
        }

        if (! Storage::disk('local')->exists($result->storage_path)) {
            throw new \RuntimeException("{$label} result file is missing from local storage.");
        }

        return Storage::disk('local')->path($result->storage_path);
    }
}
