<?php

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
    ]);
});

test('users can view their execution detail', function () {
    config(['services.ogc_processes.polling_interval' => 2500]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
    ]);

    ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->missing('execution.remoteJobId')
            ->where('pollingInterval', 2500)
            ->has('execution.results', 1));
});

test('users can view table previews for existing cached csv results', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $path = "ogc-results/{$execution->id}/table.csv";

    ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'table',
        'title' => 'Table output',
        'media_type' => 'text/csv; header=present',
        'storage_path' => $path,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => 'binary',
            'data' => ['mediaType' => 'text/csv'],
        ],
    ]);

    Storage::disk('local')->put($path, "length,gas\n0,1.23E-04\n");

    $response = $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    expect($response->inertiaProps('execution.results.0.preview'))->toMatchArray([
        'kind' => 'csv',
        'data' => [
            'headers' => ['length', 'gas'],
            'rows' => [['0', '1.23E-04']],
            'truncated' => false,
            'source' => "length,gas\n0,1.23E-04\n",
        ],
    ]);
});

test('users can view table previews for cached csv files with generic media types', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $path = "ogc-results/{$execution->id}/table.csv";

    ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'table',
        'title' => 'Table output',
        'media_type' => 'application/octet-stream',
        'storage_path' => $path,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => 'binary',
            'data' => ['mediaType' => 'application/octet-stream'],
        ],
    ]);

    Storage::disk('local')->put($path, "name,value\nEtna,42\n");

    $response = $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    expect($response->inertiaProps('execution.results.0.preview'))->toMatchArray([
        'kind' => 'csv',
        'data' => [
            'headers' => ['name', 'value'],
            'rows' => [['Etna', '42']],
            'truncated' => false,
            'source' => "name,value\nEtna,42\n",
        ],
    ]);
});

test('users can view map layer metadata on their execution detail', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'map_layer_status' => 'published',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
        'map_style_name' => 'pe_1_result_1_dem_style',
        'map_layer_bounds' => [14.1, 40.6, 14.7, 41.1],
        'map_layer_published_at' => Carbon::parse('2026-07-08 10:00:00'),
        'map_layer_error' => null,
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('execution.results.0.mapLayer.status', 'published')
            ->where('execution.results.0.mapLayer.type', 'wms')
            ->where('execution.results.0.mapLayer.name', 'pe_1_result_1_dem')
            ->where('execution.results.0.mapLayer.styleName', 'pe_1_result_1_dem_style')
            ->where('execution.results.0.mapLayer.bounds', [14.1, 40.6, 14.7, 41.1])
            ->where('execution.results.0.mapLayer.publishedAt', '2026-07-08T10:00:00+00:00')
            ->where('execution.results.0.mapLayer.error', null));
});

test('admin users can view a map layer warning when the sld only defines hillshade', function () {
    Storage::fake('local');

    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($admin)->create();

    $geotiff = cachedHillshadeMapPair($execution);

    $response = $this->actingAs($admin)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    $results = collect($response->inertiaProps('execution.results'))->keyBy('id');

    expect(data_get($results->get($geotiff->id), 'mapLayer.warning'))
        ->toBe('hillshade_without_color_map');
});

test('non admin users cannot view map layer warnings', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $geotiff = cachedHillshadeMapPair($execution);

    $response = $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    $results = collect($response->inertiaProps('execution.results'))->keyBy('id');

    expect(data_get($results->get($geotiff->id), 'mapLayer.warning'))->toBeNull();
});

test('non admin users cannot see execution input data', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'request_payload' => [
            'inputs' => [
                'melt_composition' => [
                    'value' => ['sio2' => 0.7],
                ],
            ],
        ],
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->missing('execution.requestPayload'));
});

function cachedHillshadeMapPair(ProcessExecution $execution): ProcessExecutionResult
{
    $geotiff = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'storage_path' => "ogc-results/{$execution->id}/dem.geotiff",
        'cache_status' => ResultCacheStatus::Cached,
        'map_layer_status' => 'published',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
        'map_style_name' => 'pe_1_result_1_dem_style',
    ]);

    ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.sld',
        'media_type' => 'application/vnd.ogc.sld+xml',
        'storage_path' => "ogc-results/{$execution->id}/dem.sld",
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put($geotiff->storage_path, 'DEM-TIFF');
    Storage::disk('local')->put("ogc-results/{$execution->id}/dem.sld", <<<'XML'
        <?xml version="1.0" encoding="UTF-8"?>
        <StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
            <NamedLayer>
                <UserStyle>
                    <FeatureTypeStyle>
                        <Rule>
                            <RasterSymbolizer>
                                <ShadedRelief />
                            </RasterSymbolizer>
                        </Rule>
                    </FeatureTypeStyle>
                </UserStyle>
            </NamedLayer>
        </StyledLayerDescriptor>
        XML);

    return $geotiff;
}

test('admin users can see execution input data and remote job id', function () {
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
        'request_payload' => [
            'inputs' => [
                'melt_composition' => [
                    'value' => ['sio2' => 0.7],
                ],
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->where('execution.remoteJobId', '550e8400-e29b-41d4-a716-446655440000')
            ->where('execution.requestPayload.inputs.melt_composition.value.sio2', 0.7));
});

test('users can view their job list with timeline timestamps', function () {
    Carbon::setTestNow('2026-06-10 12:30:00');
    config(['services.ogc_processes.polling_interval' => 2500]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
        'submitted_at' => now()->subMinutes(8),
        'completed_at' => now()->subMinute(),
        'failed_at' => null,
    ]);

    $this->actingAs($user)
        ->get('/jobs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/index')
            ->where('executions.data.0.id', $execution->id)
            ->missing('executions.data.0.remoteJobId')
            ->where('executions.data.0.submittedAt', now()->subMinutes(8)->toIso8601String())
            ->where('executions.data.0.completedAt', now()->subMinute()->toIso8601String())
            ->where('executions.data.0.failedAt', null)
            ->where('pollingInterval', 2500));
});

test('admin users can view their job list with remote job ids', function () {
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($admin)->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
    ]);

    $this->actingAs($admin)
        ->get('/jobs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/index')
            ->where('executions.data.0.id', $execution->id)
            ->where('executions.data.0.remoteJobId', '550e8400-e29b-41d4-a716-446655440000'));
});

test('users cannot view another users execution detail', function () {
    $execution = ProcessExecution::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get("/jobs/{$execution->id}")
        ->assertForbidden();
});

test('legacy execution routes redirect to canonical job routes', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get('/process-executions')
        ->assertRedirectToRoute('jobs.index');

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}")
        ->assertRedirectToRoute('jobs.show', $execution);

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}/results/{$result->id}/download")
        ->assertRedirectToRoute('jobs.results.download', [$execution, $result]);
});

test('users can download cached result files', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '4066039d-793d-11f1-9692-3b828b09e202',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'invasion_map',
        'media_type' => 'text/csv',
        'storage_path' => 'ogc-results/outfile.csv',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/outfile.csv', "a,b\n1,2\n");

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=utf-8')
        ->assertHeader('content-disposition', 'attachment; filename="4066039d-793d-11f1-9692-3b828b09e202_invasion_map.csv"');
});

test('users can download cached json value results without a stored file', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '4066039d-793d-11f1-9692-3b828b09e202',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'invasion_map',
        'media_type' => 'application/json',
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => 'chart',
            'data' => ogcFixture('chart-result'),
        ],
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'application/json')
        ->assertHeader('content-disposition', 'attachment; filename="4066039d-793d-11f1-9692-3b828b09e202_invasion_map.json"')
        ->assertContent(json_encode(ogcFixture('chart-result'), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
});

test('users can download cached text and csv value results without a stored file', function (string $mediaType, string $previewKind, string $outputId, string $expectedFileName, string $content) {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '4066039d-793d-11f1-9692-3b828b09e202',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => $outputId,
        'media_type' => $mediaType,
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => $previewKind,
            'data' => $content,
        ],
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', "{$mediaType}; charset=utf-8")
        ->assertHeader('content-disposition', "attachment; filename=\"{$expectedFileName}\"")
        ->assertContent($content);
})->with([
    'text value' => ['text/plain', 'text', 'stdout', '4066039d-793d-11f1-9692-3b828b09e202_stdout.txt', "line 1\nline 2\n"],
    'csv value' => ['text/csv', 'csv', 'table', '4066039d-793d-11f1-9692-3b828b09e202_table.csv', "a,b\n1,2\n"],
]);

test('users can download structured csv value results without a stored file', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '4066039d-793d-11f1-9692-3b828b09e202',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'table',
        'media_type' => 'text/csv',
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => 'csv',
            'data' => [
                'headers' => ['a', 'b'],
                'rows' => [['1', '2']],
                'truncated' => false,
                'source' => "a,b\n1,2\n",
            ],
        ],
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=utf-8')
        ->assertHeader('content-disposition', 'attachment; filename="4066039d-793d-11f1-9692-3b828b09e202_table.csv"')
        ->assertContent("a,b\n1,2\n");
});

test('users can download and cache remote result files on demand', function () {
    Storage::fake('local');
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/outfile' => Http::response("length,gas\n0,1.23E-04\n", 200, [
            'Content-Type' => 'text/csv; header=present',
        ]),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-1',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'outfile',
        'media_type' => 'text/csv',
        'remote_href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/outfile',
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::MetadataOnly,
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; header=present; charset=utf-8')
        ->assertHeader('content-disposition', 'attachment; filename="job-1_outfile.csv"');

    Storage::disk('local')->assertExists("ogc-results/{$execution->id}/job-1_outfile.csv");
    expect($result->refresh()->cache_status)->toBe(ResultCacheStatus::Cached)
        ->and($result->media_type)->toBe('text/csv; header=present');
});

test('users can proxy published map tiles for geotiff results', function () {
    config([
        'geoserver.internal_url' => 'https://geoserver.test/geoserver',
        'geoserver.username' => 'admin',
        'geoserver.password' => 'secret',
        'geoserver.workspace' => 'pygeoapi_proxy',
    ]);
    Http::preventStrayRequests();
    Http::fake([
        'https://geoserver.test/geoserver/wms*' => Http::response('PNG-TILE', 200, [
            'Content-Type' => 'image/png',
        ]),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff',
        'storage_path' => 'ogc-results/dem.geotiff',
        'cache_status' => ResultCacheStatus::Cached,
        'map_layer_status' => 'published',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
        'map_style_name' => 'pe_1_result_1_dem_style',
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/map-tile?bbox=1569600,4953500,1570600,4954500&width=256&height=256")
        ->assertOk()
        ->assertHeader('content-type', 'image/png')
        ->assertSee('PNG-TILE', false);

    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://geoserver.test/geoserver/wms')
        && $request['service'] === 'WMS'
        && $request['request'] === 'GetMap'
        && $request['srs'] === 'EPSG:3857'
        && $request['layers'] === 'pygeoapi_proxy:pe_1_result_1_dem'
        && $request['bbox'] === '1569600,4953500,1570600,4954500'
        && (int) $request['width'] === 256
        && (int) $request['height'] === 256);
});

test('map tile endpoint rejects users who cannot view the job', function () {
    $execution = ProcessExecution::factory()->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'map_layer_status' => 'published',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/jobs/{$execution->id}/results/{$result->id}/map-tile?bbox=0,0,1,1")
        ->assertForbidden();
});

test('map tile endpoint rejects results from a different job', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $otherExecution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($otherExecution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'map_layer_status' => 'published',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/map-tile?bbox=0,0,1,1")
        ->assertNotFound();
});

test('map tile endpoint rejects unpublished layers', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'map_layer_status' => 'pending',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/map-tile?bbox=0,0,1,1")
        ->assertNotFound();
});

test('map tile endpoint validates bbox and dimensions', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'map_layer_status' => 'published',
        'map_layer_type' => 'wms',
        'map_layer_name' => 'pe_1_result_1_dem',
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/map-tile?bbox=0,1,2&width=0&height=2048")
        ->assertSessionHasErrors(['bbox', 'width', 'height']);
});

test('old preview file endpoint is not exposed', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/preview-file")
        ->assertNotFound();
});
