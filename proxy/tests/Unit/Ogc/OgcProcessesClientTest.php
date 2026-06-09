<?php

use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

function ogcFixture(string $name): array
{
    return json_decode(
        file_get_contents(base_path("tests/Fixtures/Ogc/{$name}.json")),
        true,
        flags: JSON_THROW_ON_ERROR,
    );
}

beforeEach(function () {
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.timeout' => 12,
        'services.ogc_processes.connect_timeout' => 4,
    ]);
});

test('it fetches the landing page with json format', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/?f=json' => Http::response(ogcFixture('landing-page')),
    ]);

    $data = app(OgcProcessesClient::class)->landingPage();

    expect($data['title'])->toBe('Geo-INQUIRE Saas WP5 (based on pygeoapi)');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://voice.pi.ingv.it/geoinquire/?f=json'
        && $request->method() === 'GET');
});

test('it fetches the process list', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
    ]);

    $data = app(OgcProcessesClient::class)->processes();

    expect($data['processes'])
        ->toHaveCount(3)
        ->and($data['processes'][0]['id'])->toBe('solwcad');
});

test('it fetches a process description', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
    ]);

    $data = app(OgcProcessesClient::class)->process('conduit');

    expect($data['id'])->toBe('conduit')
        ->and($data['inputs'])->toHaveKey('melt_composition');
});

test('it submits sync execution with prefer header', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(['chartType' => 'line'], 200),
    ]);

    $response = app(OgcProcessesClient::class)->execute('conduit', [
        'inputs' => ['lat' => 1],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ], 'respond-sync');

    expect($response->status())->toBe(200)
        ->and($response->json('chartType'))->toBe('line');

    Http::assertSent(fn (Request $request): bool => $request->hasHeader('Prefer', 'respond-sync')
        && $request->hasHeader('Content-Type', 'application/json')
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution');
});

test('it fetches a remote job and results', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(['jobID' => 'job-123', 'status' => 'successful']),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response(['chartType' => 'line']),
    ]);

    $client = app(OgcProcessesClient::class);

    expect($client->job('job-123')['status'])->toBe('successful')
        ->and($client->jobResults('job-123')->json('chartType'))->toBe('line');
});

test('it rejects absolute result download urls outside the configured base url', function () {
    Http::fake();

    app(OgcProcessesClient::class)->downloadResultUrl('https://example.test/result.tif');
})->throws(InvalidArgumentException::class, 'Result URL is outside the configured OGC Processes base URL.');
