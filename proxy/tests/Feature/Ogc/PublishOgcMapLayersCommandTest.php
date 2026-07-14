<?php

use App\Enums\Ogc\MapLayerStatus;
use App\Enums\Ogc\ResultCacheStatus;
use App\Jobs\Ogc\PublishGeoTiffMapLayerJob;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Support\Facades\Bus;

test('it requires an execution id unless all is requested', function () {
    $this->artisan('ogc:publish-map-layers')
        ->expectsOutput('Provide a process execution id or pass --all.')
        ->assertFailed();
});

test('it dispatches publication jobs for a single execution', function () {
    Bus::fake([PublishGeoTiffMapLayerJob::class]);
    $execution = ProcessExecution::factory()->create();
    [$geotiff, $sld] = cachedMapPair($execution);

    $this->artisan("ogc:publish-map-layers {$execution->id}")
        ->expectsOutput('Dispatched 1 map layer publication job.')
        ->assertSuccessful();

    expect($geotiff->refresh()->map_layer_status)->toBe(MapLayerStatus::Pending)
        ->and($geotiff->map_layer_type)->toBe('wms');

    Bus::assertDispatched(PublishGeoTiffMapLayerJob::class, fn (PublishGeoTiffMapLayerJob $job): bool => $job->processExecutionId === $execution->id
        && $job->geoTiffResultId === $geotiff->id
        && $job->sldResultId === $sld->id);
});

test('it can requeue failed publications when requested', function () {
    Bus::fake([PublishGeoTiffMapLayerJob::class]);
    $execution = ProcessExecution::factory()->create();
    [$geotiff, $sld] = cachedMapPair($execution, [
        'map_layer_status' => MapLayerStatus::Failed,
        'map_layer_type' => 'wms',
        'map_layer_error' => 'Previous failure.',
    ]);

    $this->artisan("ogc:publish-map-layers {$execution->id}")
        ->expectsOutput('Dispatched 0 map layer publication jobs.')
        ->assertSuccessful();

    Bus::assertNotDispatched(PublishGeoTiffMapLayerJob::class);

    $this->artisan("ogc:publish-map-layers {$execution->id} --failed")
        ->expectsOutput('Dispatched 1 map layer publication job.')
        ->assertSuccessful();

    expect($geotiff->refresh()->map_layer_status)->toBe(MapLayerStatus::Pending)
        ->and($geotiff->map_layer_error)->toBeNull();

    Bus::assertDispatched(PublishGeoTiffMapLayerJob::class, fn (PublishGeoTiffMapLayerJob $job): bool => $job->geoTiffResultId === $geotiff->id
        && $job->sldResultId === $sld->id);
});

test('it requeues published map layers without stored bounds', function () {
    Bus::fake([PublishGeoTiffMapLayerJob::class]);
    $execution = ProcessExecution::factory()->create();
    [$geotiff, $sld] = cachedMapPair($execution, [
        'map_layer_status' => MapLayerStatus::Published,
        'map_layer_type' => 'wms',
        'map_layer_bounds' => null,
    ]);

    $this->artisan("ogc:publish-map-layers {$execution->id}")
        ->expectsOutput('Dispatched 1 map layer publication job.')
        ->assertSuccessful();

    expect($geotiff->refresh()->map_layer_status)->toBe(MapLayerStatus::Pending)
        ->and($geotiff->map_layer_type)->toBe('wms');

    Bus::assertDispatched(PublishGeoTiffMapLayerJob::class, fn (PublishGeoTiffMapLayerJob $job): bool => $job->geoTiffResultId === $geotiff->id
        && $job->sldResultId === $sld->id);
});

/**
 * @param  array<string, mixed>  $geotiffOverrides
 * @return array{0: ProcessExecutionResult, 1: ProcessExecutionResult}
 */
function cachedMapPair(ProcessExecution $execution, array $geotiffOverrides = []): array
{
    $geotiff = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'title' => 'Primary DEM - Reference to the GeoTIFF.',
        'media_type' => 'image/tiff; application=geotiff',
        'storage_path' => "ogc-results/{$execution->id}/dem.geotiff",
        'cache_status' => ResultCacheStatus::Cached,
        ...$geotiffOverrides,
    ]);

    $sld = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.sld',
        'title' => 'Primary DEM - Reference to the Styled Layer Descriptor (SLD) defining the visualization style for this GeoTIFF.',
        'media_type' => 'application/vnd.ogc.sld+xml',
        'storage_path' => "ogc-results/{$execution->id}/dem.sld",
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    return [$geotiff, $sld];
}
