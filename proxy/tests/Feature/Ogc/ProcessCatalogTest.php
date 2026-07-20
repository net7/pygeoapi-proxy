<?php

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Carbon::setTestNow();
    Cache::flush();
    Http::preventStrayRequests();
    Http::allowStrayRequests(['*__inertia_ssr']);

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
});

test('guests cannot access process catalog', function () {
    $this->get('/processes')->assertRedirect(route('login'));
});

test('authenticated users can view cached process catalog', function () {
    app(OgcProcessCache::class)->putCatalog(ogcFixture('processes'));

    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->where('catalogStatus', 'ready')
            ->has('processes', 3));
});

test('authenticated users see catalog warming state when cache is missing', function () {
    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->where('catalogStatus', 'warming')
            ->has('processes', 0));
});

test('authenticated users see the latest catalog without warming when fresh cache is missing', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-02 10:30:00'));

    app(OgcProcessCache::class)->putCatalog(ogcFixture('processes'));
    Cache::forget(OgcProcessCache::CatalogKey);

    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->where('catalogStatus', 'ready')
            ->where('catalogLastUpdatedAt', now()->toIso8601String())
            ->has('processes', 3));
});

test('authenticated users trigger warm-up when catalog cache is missing', function () {
    Bus::fake();

    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk();

    Bus::assertDispatched(WarmOgcProcessCacheJob::class);
});

test('authenticated users can view cached process detail with normalized schema', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('process.id', 'conduit')
            ->where('inputPrefill', null)
            ->has('formSchema.fields.melt_composition'));
});

test('process detail exposes only reusable inputs from an authorized source job', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $user = User::factory()->create();
    $sourceJob = ProcessExecution::factory()->for($user)->create([
        'name' => 'Scenario sorgente',
        'process_id' => 'conduit',
        'request_payload' => [
            'inputs' => [
                'melt_composition' => [
                    'value' => ['sio2' => 0.7669],
                ],
                'searching_mode' => [
                    'value' => '[redacted inline value]',
                    'sizeBytes' => 4096,
                ],
                'retired_input' => 12,
            ],
            'outputs' => ['gas' => ['transmissionMode' => 'value']],
        ],
    ]);

    $this->actingAs($user)
        ->get(route('processes.show', [
            'process' => 'conduit',
            'sourceJob' => $sourceJob->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('inputPrefill.sourceJobId', $sourceJob->id)
            ->where('inputPrefill.sourceJobName', 'Scenario sorgente')
            ->where('inputPrefill.inputs.melt_composition.value.sio2', 0.7669)
            ->where('inputPrefill.skippedInputs', [
                'searching_mode',
                'retired_input',
            ])
            ->missing('inputPrefill.inputs.searching_mode')
            ->missing('inputPrefill.inputs.retired_input')
            ->missing('inputPrefill.outputs'));
});

test('process detail skips a whole input when its stored object contains removed fields', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $user = User::factory()->create();
    $sourceJob = ProcessExecution::factory()->for($user)->create([
        'process_id' => 'conduit',
        'request_payload' => [
            'inputs' => [
                'melt_composition' => [
                    'value' => [
                        'sio2' => 0.7669,
                        'retired_component' => 0.1,
                    ],
                ],
                'geometry' => [
                    'value' => ['g' => 'conduit', 'l' => 1000],
                ],
            ],
        ],
    ]);

    $this->actingAs($user)
        ->get(route('processes.show', [
            'process' => 'conduit',
            'sourceJob' => $sourceJob->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('inputPrefill.skippedInputs', ['melt_composition'])
            ->where('inputPrefill.inputs.geometry.value.g', 'conduit')
            ->missing('inputPrefill.inputs.melt_composition'));
});

test('users cannot reuse inputs from another users job', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $sourceJob = ProcessExecution::factory()->create([
        'process_id' => 'conduit',
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('processes.show', [
            'process' => 'conduit',
            'sourceJob' => $sourceJob->id,
        ]))
        ->assertForbidden();
});

test('users cannot reuse inputs on a different process', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $user = User::factory()->create();
    $sourceJob = ProcessExecution::factory()->for($user)->create([
        'process_id' => 'pybox',
    ]);

    $this->actingAs($user)
        ->get(route('processes.show', [
            'process' => 'conduit',
            'sourceJob' => $sourceJob->id,
        ]))
        ->assertNotFound();
});

test('authenticated users see process warming state when detail cache is missing', function () {
    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'warming')
            ->where('process', null)
            ->where('formSchema', null));
});

test('authenticated users see the latest process detail without warming when fresh cache is missing', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-02 10:45:00'));

    $cache = app(OgcProcessCache::class);
    $cache->putProcess('conduit', ogcFixture('process-conduit'));
    Cache::forget($cache->processKey('conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('process.id', 'conduit')
            ->where('processLastUpdatedAt', now()->toIso8601String())
            ->has('formSchema.fields.melt_composition'));
});

test('authenticated users trigger warm-up when process detail cache is missing', function () {
    Bus::fake();

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk();

    Bus::assertDispatched(WarmOgcProcessCacheJob::class);
});

test('process detail exposes example payload for local environments', function () {
    app()->detectEnvironment(fn (): string => 'local');
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('formSchema.examplePayload.inputs.melt_composition.value.sio2', 0.7669)
            ->where('formSchema.examplePayload.outputs.gas.transmissionMode', 'value'));
});

test('process detail hides example payload outside local environments', function () {
    app()->detectEnvironment(fn (): string => 'production');
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('formSchema.examplePayload', null));
});
