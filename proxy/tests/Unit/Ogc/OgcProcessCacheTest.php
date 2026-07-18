<?php

use App\Services\Ogc\OgcProcessCache;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    Carbon::setTestNow();
    Cache::flush();
    Http::preventStrayRequests();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
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

test('it serves the latest successful catalog when the fresh catalog expires', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-02 10:30:00'));

    $cache = app(OgcProcessCache::class);

    $cache->putCatalog(ogcFixture('processes'));
    Cache::forget(OgcProcessCache::CatalogKey);

    expect($cache->catalog()['processes'])->toHaveCount(3)
        ->and($cache->catalogLastUpdatedAt())->toBe(now()->toIso8601String());
});

test('it serves the latest successful process description when the fresh process expires', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-02 10:45:00'));

    $cache = app(OgcProcessCache::class);

    $cache->putProcess('conduit', ogcFixture('process-conduit'));
    Cache::forget($cache->processKey('conduit'));

    expect($cache->process('conduit')['id'])->toBe('conduit')
        ->and($cache->processLastUpdatedAt('conduit'))->toBe(now()->toIso8601String());
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
