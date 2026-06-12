<?php

use App\Services\Ogc\OgcProcessCache;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

test('it warms the catalog and every process description', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
        'https://voice.pi.ingv.it/geoinquire/processes/solwcad?f=json' => Http::response(ogcFixture('process-solwcad')),
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
        'https://voice.pi.ingv.it/geoinquire/processes/pybox?f=json' => Http::response(ogcFixture('process-pybox')),
    ]);

    $cache = app(OgcProcessCache::class);

    $cache->warm();

    expect($cache->catalog()['processes'])->toHaveCount(3)
        ->and($cache->process('solwcad')['id'])->toBe('solwcad')
        ->and($cache->process('conduit')['id'])->toBe('conduit')
        ->and($cache->process('pybox')['id'])->toBe('pybox');

    Http::assertSentCount(4);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://voice.pi.ingv.it/geoinquire/processes?f=json');
});

test('it returns null for missing catalog and process cache entries', function () {
    $cache = app(OgcProcessCache::class);

    expect($cache->catalog())->toBeNull()
        ->and($cache->process('conduit'))->toBeNull();
});

test('it extracts process ids from valid catalog entries only', function () {
    $cache = app(OgcProcessCache::class);

    expect($cache->processIds([
        'processes' => [
            ['id' => 'solwcad'],
            ['id' => ''],
            ['title' => 'Missing id'],
            ['id' => 'conduit'],
            ['id' => 'solwcad'],
            'invalid',
        ],
    ]))->toBe(['solwcad', 'conduit']);
});
