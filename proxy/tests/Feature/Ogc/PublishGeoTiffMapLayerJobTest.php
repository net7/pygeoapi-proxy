<?php

use App\Enums\Ogc\MapLayerStatus;
use App\Enums\Ogc\ResultCacheStatus;
use App\Jobs\Ogc\PublishGeoTiffMapLayerJob;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\GeoServerClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config([
        'geoserver.enabled' => true,
        'geoserver.internal_url' => 'https://geoserver.test/geoserver',
        'geoserver.username' => 'admin',
        'geoserver.password' => 'secret',
        'geoserver.workspace' => 'pygeoapi_proxy',
    ]);
});

test('it publishes cached geotiff and sld outputs to geoserver', function () {
    Storage::fake('local');
    Http::preventStrayRequests();
    Http::fake([
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy.json' => Http::response('', 404),
        'https://geoserver.test/geoserver/rest/workspaces' => Http::response('', 201),
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy/coveragestores/*' => Http::response('', 201),
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy/styles/*.json' => Http::response('', 404),
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy/styles' => Http::response('', 201),
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy/styles/*' => Http::response('', 200),
        'https://geoserver.test/geoserver/rest/layers/pygeoapi_proxy:*' => Http::response('', 200),
    ]);

    [$execution, $geotiff, $sld] = mapLayerPublicationFixture();

    (new PublishGeoTiffMapLayerJob($execution->id, $geotiff->id, $sld->id))
        ->handle(app(GeoServerClient::class));

    $geotiff->refresh();

    expect($geotiff->map_layer_status)->toBe(MapLayerStatus::Published)
        ->and($geotiff->map_layer_type)->toBe('wms')
        ->and($geotiff->map_layer_name)->toStartWith("pe_{$execution->id}_result_{$geotiff->id}")
        ->and($geotiff->map_style_name)->toEndWith('_style')
        ->and($geotiff->map_layer_error)->toBeNull()
        ->and($geotiff->map_layer_published_at)->not->toBeNull();

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/coveragestores/')
        && str_contains($request->url(), 'configure=all')
        && str_contains($request->url(), 'coverageName=')
        && $request->hasHeader('Content-Type', 'image/tiff'));

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/styles/')
        && $request->hasHeader('Content-Type', 'application/vnd.ogc.sld+xml'));
});

test('it marks the map layer as failed when geoserver publication fails', function () {
    Storage::fake('local');
    Http::preventStrayRequests();
    Http::fake([
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy.json' => Http::response('', 200),
        'https://geoserver.test/geoserver/rest/workspaces/pygeoapi_proxy/coveragestores/*' => Http::response('nope', 500),
    ]);

    [$execution, $geotiff, $sld] = mapLayerPublicationFixture();

    try {
        (new PublishGeoTiffMapLayerJob($execution->id, $geotiff->id, $sld->id))
            ->handle(app(GeoServerClient::class));
    } catch (RuntimeException) {
        $geotiff->refresh();

        expect($geotiff->map_layer_status)->toBe(MapLayerStatus::Failed)
            ->and($geotiff->map_layer_error)->toContain('GeoServer GeoTIFF publication failed');

        return;
    }

    $this->fail('Expected GeoServer publication to throw.');
});

test('it does not publish when geoserver publication is disabled', function () {
    config(['geoserver.enabled' => false]);
    Storage::fake('local');
    Http::preventStrayRequests();
    Http::fake();

    [$execution, $geotiff, $sld] = mapLayerPublicationFixture();

    (new PublishGeoTiffMapLayerJob($execution->id, $geotiff->id, $sld->id))
        ->handle(app(GeoServerClient::class));

    expect($geotiff->refresh()->map_layer_status)->toBeNull();

    Http::assertNothingSent();
});

/**
 * @return array{0: ProcessExecution, 1: ProcessExecutionResult, 2: ProcessExecutionResult}
 */
function mapLayerPublicationFixture(): array
{
    $execution = ProcessExecution::factory()->create();

    $geotiff = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'title' => 'Primary DEM - Reference to the GeoTIFF.',
        'media_type' => 'image/tiff; application=geotiff',
        'storage_path' => "ogc-results/{$execution->id}/dem.geotiff",
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    $sld = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.sld',
        'title' => 'Primary DEM - Reference to the Styled Layer Descriptor (SLD) defining the visualization style for this GeoTIFF.',
        'media_type' => 'application/vnd.ogc.sld+xml',
        'storage_path' => "ogc-results/{$execution->id}/dem.sld",
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put($geotiff->storage_path, 'DEM-TIFF');
    Storage::disk('local')->put($sld->storage_path, '<StyledLayerDescriptor />');

    return [$execution, $geotiff, $sld];
}
