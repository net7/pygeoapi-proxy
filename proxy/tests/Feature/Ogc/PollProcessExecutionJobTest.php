<?php

use App\Actions\Ogc\PollProcessExecution;
use App\Enums\Ogc\ExecutionStatus;
use App\Enums\Ogc\MapLayerStatus;
use App\Enums\Ogc\ResultCacheStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Jobs\Ogc\PublishGeoTiffMapLayerJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Bus::fake([PublishGeoTiffMapLayerJob::class]);
});

test('it marks successful jobs and stores results', function () {
    Notification::fake();

    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['gas' => ['transmissionMode' => 'value']],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response(ogcFixture('chart-result')),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $execution->refresh();

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->progress)->toBe(100)
        ->and($execution->results)->toHaveCount(1);

    Notification::assertSentTo(
        $execution->user,
        ProcessExecutionCompleted::class,
        function (ProcessExecutionCompleted $notification) use ($execution) {
            $data = $notification->toDatabase($execution->user)->data;

            return $data['title'] === 'Process completed'
                && $data['body'] === 'The process finished successfully and the results are ready.'
                && $data['icon'] === 'check-circle'
                && $data['tone'] === 'success'
                && $data['action_url'] === route('jobs.show', $execution);
        },
    );
});

test('it stores each multipart result using process output definitions', function () {
    Notification::fake();
    Storage::fake('local');

    $boundary = 'result-boundary';
    $body = implode("\r\n", [
        '--'.$boundary,
        'Content-Disposition: form-data; name="gas"',
        'Content-Type: application/json',
        '',
        json_encode(ogcFixture('chart-result'), JSON_THROW_ON_ERROR),
        '--'.$boundary,
        'Content-Disposition: form-data; name="outfile"; filename="outfile.csv"',
        'Content-Type: text/csv',
        '',
        "length,gas\r\n0,10\r\n1,20\r\n",
        '--'.$boundary.'--',
        '',
    ]);

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'conduit',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => [
            'gas' => ['transmissionMode' => 'value'],
            'outfile' => ['transmissionMode' => 'value'],
        ],
        'process_outputs' => ogcFixture('process-conduit')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response($body, 200, [
            'Content-Type' => 'multipart/mixed; boundary="'.$boundary.'"',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $execution->refresh();
    $results = $execution->results()->orderBy('output_id')->get()->keyBy('output_id');

    expect($results)->toHaveCount(2)
        ->and($results['gas']->title)->toBe('Plot gas volume fraction')
        ->and($results['gas']->media_type)->toBe('application/json')
        ->and($results['gas']->preview['kind'])->toBe('chart')
        ->and($results['outfile']->title)->toBe('Table of output variables')
        ->and($results['outfile']->media_type)->toBe('text/csv')
        ->and($results['outfile']->preview['kind'])->toBe('csv')
        ->and($results['outfile']->preview['data'])->toContain('length,gas');
});

test('it caches binary multipart results on local storage', function () {
    Notification::fake();
    Storage::fake('local');

    $boundary = 'binary-boundary';
    $body = implode("\r\n", [
        '--'.$boundary,
        'Content-Disposition: form-data; name="invasion_map"; filename="invasion_map.tif"',
        'Content-Type: application/tiff; application=geotiff',
        '',
        'TIFF-BINARY-CONTENT',
        '--'.$boundary.'--',
        '',
    ]);

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'pybox',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['invasion_map' => ['transmissionMode' => 'value']],
        'process_outputs' => ogcFixture('process-pybox')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response($body, 200, [
            'Content-Type' => 'multipart/mixed; boundary="'.$boundary.'"',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $result = $execution->refresh()->results()->sole();

    expect($result->output_id)->toBe('invasion_map')
        ->and($result->title)->toBe('Invasion Map')
        ->and($result->preview)->toBe([
            'kind' => 'binary',
            'data' => [
                'mediaType' => 'application/tiff',
                'sizeBytes' => strlen('TIFF-BINARY-CONTENT'),
            ],
        ])
        ->and($result->storage_path)->not->toBeNull();

    Storage::disk('local')->assertExists($result->storage_path);
});

test('it expands object output links returned in json results', function () {
    Notification::fake();
    Storage::fake('local');

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'pybox',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => [
            'dem' => ['transmissionMode' => 'reference'],
            'invasion_map' => ['transmissionMode' => 'reference'],
        ],
        'process_outputs' => ogcFixture('process-pybox')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response([
            'dem' => [
                'geotiff' => [
                    'href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/dem.tif',
                    'type' => 'image/tiff; application=geotiff',
                    'title' => 'GeoTIFF',
                ],
                'sld' => [
                    'href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/dem.sld',
                    'type' => 'application/vnd.ogc.sld+xml',
                    'title' => 'Styled Layer Descriptor',
                ],
            ],
            'invasion_map' => [
                'geotiff' => [
                    'href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/invasion_map.tif',
                    'type' => 'image/tiff; application=geotiff',
                    'title' => 'GeoTIFF',
                ],
                'sld' => [
                    'href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/invasion_map.sld',
                    'type' => 'application/vnd.ogc.sld+xml',
                    'title' => 'Styled Layer Descriptor',
                ],
            ],
        ]),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/dem.tif' => Http::response('DEM-TIFF', 200, [
            'Content-Type' => 'image/tiff; application=geotiff',
        ]),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/dem.sld' => Http::response('<sld>dem</sld>', 200, [
            'Content-Type' => 'application/vnd.ogc.sld+xml',
        ]),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/invasion_map.tif' => Http::response('INVASION-TIFF', 200, [
            'Content-Type' => 'image/tiff; application=geotiff',
        ]),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/invasion_map.sld' => Http::response('<sld>invasion</sld>', 200, [
            'Content-Type' => 'application/vnd.ogc.sld+xml',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $results = $execution->refresh()->results()->orderBy('output_id')->get()->keyBy('output_id');

    expect($results)->toHaveCount(4)
        ->and($results)->toHaveKeys([
            'dem.geotiff',
            'dem.sld',
            'invasion_map.geotiff',
            'invasion_map.sld',
        ])
        ->and($results['dem.geotiff']->remote_href)->toBe('https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/dem.tif')
        ->and($results['dem.geotiff']->media_type)->toBe('image/tiff; application=geotiff')
        ->and($results['dem.geotiff']->cache_status)->toBe(ResultCacheStatus::Cached)
        ->and($results['dem.geotiff']->size_bytes)->toBe(strlen('DEM-TIFF'))
        ->and($results['dem.sld']->remote_href)->toBe('https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/dem.sld')
        ->and($results['dem.sld']->media_type)->toBe('application/vnd.ogc.sld+xml')
        ->and($results['dem.sld']->cache_status)->toBe(ResultCacheStatus::Cached)
        ->and($results['invasion_map.geotiff']->remote_href)->toBe('https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/invasion_map.tif')
        ->and($results['invasion_map.geotiff']->media_type)->toBe('image/tiff; application=geotiff')
        ->and($results['invasion_map.geotiff']->cache_status)->toBe(ResultCacheStatus::Cached)
        ->and($results['invasion_map.sld']->remote_href)->toBe('https://voice.pi.ingv.it/geoinquire/jobs/job-123/results/invasion_map.sld')
        ->and($results['invasion_map.sld']->media_type)->toBe('application/vnd.ogc.sld+xml')
        ->and($results['invasion_map.sld']->cache_status)->toBe(ResultCacheStatus::Cached);

    foreach ($results as $result) {
        expect($result->storage_path)->not->toBeNull();
        Storage::disk('local')->assertExists($result->storage_path);
    }
});

test('it queues map layer publication when cached geotiff and sld outputs are stored', function () {
    Notification::fake();
    Storage::fake('local');

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'pybox',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['dem' => ['transmissionMode' => 'reference']],
        'process_outputs' => ogcFixture('process-pybox')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response([
            'geotiff' => [
                'title' => 'Reference to the GeoTIFF.',
                'type' => 'application/tiff; application=geotiff',
                'href' => 'https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif',
            ],
            'sld' => [
                'title' => 'Reference to the Styled Layer Descriptor (SLD) defining the visualization style for this GeoTIFF.',
                'type' => 'application/vnd.ogc.sld+xml',
                'href' => 'https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld',
            ],
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif' => Http::response('DEM-TIFF', 200, [
            'Content-Type' => 'application/tiff; application=geotiff',
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld' => Http::response('<sld>dem</sld>', 200, [
            'Content-Type' => 'application/vnd.ogc.sld+xml',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $results = $execution->refresh()->results()->orderBy('output_id')->get()->keyBy('output_id');

    expect($results['dem.geotiff']->map_layer_status)->toBe(MapLayerStatus::Pending)
        ->and($results['dem.geotiff']->map_layer_type)->toBe('wms');

    Bus::assertDispatched(PublishGeoTiffMapLayerJob::class, fn (PublishGeoTiffMapLayerJob $job): bool => $job->processExecutionId === $execution->id
        && $job->geoTiffResultId === $results['dem.geotiff']->id
        && $job->sldResultId === $results['dem.sld']->id);
});

test('it expands an indirect single object output returned by reference', function () {
    Notification::fake();
    Storage::fake('local');

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'pybox',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['dem' => ['transmissionMode' => 'reference']],
        'process_outputs' => ogcFixture('process-pybox')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response([
            'geotiff' => [
                'title' => 'Reference to the GeoTIFF.',
                'type' => 'application/tiff; application=geotiff',
                'href' => 'https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif',
            ],
            'sld' => [
                'title' => 'Reference to the Styled Layer Descriptor (SLD) defining the visualization style for this GeoTIFF.',
                'type' => 'application/vnd.ogc.sld+xml',
                'href' => 'https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld',
            ],
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif' => Http::response('DEM-TIFF', 200, [
            'Content-Type' => 'application/tiff; application=geotiff',
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld' => Http::response('<sld>dem</sld>', 200, [
            'Content-Type' => 'application/vnd.ogc.sld+xml',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $results = $execution->refresh()->results()->orderBy('output_id')->get()->keyBy('output_id');

    expect($results)->toHaveCount(2)
        ->and($results)->toHaveKeys(['dem.geotiff', 'dem.sld'])
        ->and($results['dem.geotiff']->remote_href)->toBe('https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif')
        ->and($results['dem.geotiff']->media_type)->toBe('application/tiff; application=geotiff')
        ->and($results['dem.geotiff']->transmission_mode)->toBe('reference')
        ->and($results['dem.geotiff']->cache_status)->toBe(ResultCacheStatus::Cached)
        ->and($results['dem.sld']->remote_href)->toBe('https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld')
        ->and($results['dem.sld']->media_type)->toBe('application/vnd.ogc.sld+xml')
        ->and($results['dem.sld']->transmission_mode)->toBe('reference')
        ->and($results['dem.sld']->cache_status)->toBe(ResultCacheStatus::Cached);

    foreach ($results as $result) {
        expect($result->storage_path)->not->toBeNull();
        Storage::disk('local')->assertExists($result->storage_path);
    }
});

test('it downloads multipart result links and expands indirect object output locations', function () {
    Notification::fake();
    Storage::fake('local');

    $boundary = 'indirect-boundary';
    $body = implode("\r\n", [
        '--'.$boundary,
        'Content-Type: application/json',
        'Content-ID: <dem>',
        'Content-Location: https://voice_hrefs.pi.ingv.it/results/job-123_dem.json',
        '',
        '',
        '--'.$boundary.'--',
        '',
    ]);

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'pybox',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['dem' => ['transmissionMode' => 'reference']],
        'process_outputs' => ogcFixture('process-pybox')['outputs'],
    ]);

    $job = [
        ...ogcFixture('job-successful'),
        'links' => [
            [
                'href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results',
                'rel' => 'http://www.opengis.net/def/rel/ogc/1.0/results',
                'type' => 'multipart/related; boundary="'.$boundary.'"',
            ],
        ],
    ];

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response($job),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response($body, 200, [
            'Content-Type' => 'multipart/related; boundary="'.$boundary.'"',
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.json' => Http::response([
            'geotiff' => [
                'title' => 'Reference to the GeoTIFF.',
                'type' => 'application/tiff; application=geotiff',
                'href' => 'https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif',
            ],
            'sld' => [
                'title' => 'Reference to the Styled Layer Descriptor (SLD) defining the visualization style for this GeoTIFF.',
                'type' => 'application/vnd.ogc.sld+xml',
                'href' => 'https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld',
            ],
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif' => Http::response('DEM-TIFF', 200, [
            'Content-Type' => 'application/tiff; application=geotiff',
        ]),
        'https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld' => Http::response('<sld>dem</sld>', 200, [
            'Content-Type' => 'application/vnd.ogc.sld+xml',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $results = $execution->refresh()->results()->orderBy('output_id')->get()->keyBy('output_id');

    expect($results)->toHaveCount(2)
        ->and($results)->toHaveKeys(['dem.geotiff', 'dem.sld'])
        ->and($results['dem.geotiff']->remote_href)->toBe('https://voice_hrefs.pi.ingv.it/results/job-123_dem.tif')
        ->and($results['dem.geotiff']->cache_status)->toBe(ResultCacheStatus::Cached)
        ->and($results['dem.sld']->remote_href)->toBe('https://voice_hrefs.pi.ingv.it/results/job-123_dem.sld')
        ->and($results['dem.sld']->cache_status)->toBe(ResultCacheStatus::Cached);

    foreach ($results as $result) {
        expect($result->storage_path)->not->toBeNull();
        Storage::disk('local')->assertExists($result->storage_path);
    }
});

test('it marks failed jobs and notifies the user', function () {
    Notification::fake();

    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'job-456',
        'status' => ExecutionStatus::Running,
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-456?f=json' => Http::response(ogcFixture('job-failed')),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $execution->refresh();

    expect($execution->status)->toBe(ExecutionStatus::Failed)
        ->and($execution->message)->toContain('InvalidParameterValue');

    Notification::assertSentTo(
        $execution->user,
        ProcessExecutionCompleted::class,
        function (ProcessExecutionCompleted $notification) use ($execution) {
            $data = $notification->toDatabase($execution->user)->data;

            return $data['title'] === 'Process failed'
                && str_contains($data['body'], 'InvalidParameterValue')
                && $data['icon'] === 'circle-alert'
                && $data['tone'] === 'error'
                && $data['action_url'] === route('jobs.show', $execution);
        },
    );
});

test('it marks missing remote jobs', function () {
    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'missing-job',
        'status' => ExecutionStatus::Running,
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/missing-job?f=json' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'missing-job',
        ], 404),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    expect($execution->refresh()->status)->toBe(ExecutionStatus::RemoteMissing);
});
