<?php

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use App\Services\Ogc\OgcProcessCache;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::flush();
});

test('it dispatches warm-up for queue runtime commands once per window', function () {
    Bus::fake();

    $dispatcher = app(OgcProcessCacheWarmupDispatcher::class);

    expect($dispatcher->dispatchForCommand('queue:work'))->toBeTrue()
        ->and(Cache::has(OgcProcessCache::WarmupDispatchedKey))->toBeTrue()
        ->and($dispatcher->dispatchForCommand('queue:work'))->toBeFalse();

    Bus::assertDispatchedTimes(WarmOgcProcessCacheJob::class, 1);
});

test('it dispatches warm-up for horizon commands', function () {
    Bus::fake();

    expect(app(OgcProcessCacheWarmupDispatcher::class)->dispatchForCommand('horizon'))->toBeTrue();

    Bus::assertDispatched(WarmOgcProcessCacheJob::class);
});

test('it skips non queue runtime commands', function () {
    Bus::fake();

    $dispatcher = app(OgcProcessCacheWarmupDispatcher::class);

    expect($dispatcher->dispatchForCommand('migrate'))->toBeFalse()
        ->and($dispatcher->dispatchForCommand('route:list'))->toBeFalse()
        ->and($dispatcher->dispatchForCommand('config:cache'))->toBeFalse()
        ->and($dispatcher->dispatchForCommand(null))->toBeFalse();

    Bus::assertNotDispatched(WarmOgcProcessCacheJob::class);
});

test('it skips automatic dispatch while tests are running', function () {
    Bus::fake();

    expect(app(OgcProcessCacheWarmupDispatcher::class)->dispatchIfAppropriate())->toBeFalse();

    Bus::assertNotDispatched(WarmOgcProcessCacheJob::class);
});
