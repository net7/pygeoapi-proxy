<?php

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

test('it warms the ogc process cache', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
        'https://voice.pi.ingv.it/geoinquire/processes/solwcad?f=json' => Http::response(ogcFixture('process-solwcad')),
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
        'https://voice.pi.ingv.it/geoinquire/processes/pybox?f=json' => Http::response(ogcFixture('process-pybox')),
    ]);

    (new WarmOgcProcessCacheJob)->handle(app(OgcProcessCache::class));

    $cache = app(OgcProcessCache::class);

    expect($cache->catalog()['processes'])->toHaveCount(3)
        ->and($cache->process('conduit')['id'])->toBe('conduit');
});

test('it prevents overlapping warm-up executions', function () {
    $middleware = (new WarmOgcProcessCacheJob)->middleware();

    expect($middleware)->toHaveCount(1)
        ->and($middleware[0])->toBeInstanceOf(WithoutOverlapping::class);
});

test('it retries with progressive backoff', function () {
    $job = new WarmOgcProcessCacheJob;

    expect($job->tries)->toBe(3)
        ->and($job->backoff())->toBe([30, 120, 300]);
});
