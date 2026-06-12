<?php

use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
    Http::preventStrayRequests();
    Http::allowStrayRequests(['*__inertia_ssr']);

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'services.ogc_processes.cache_ttl' => 300,
    ]);
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

test('authenticated users can view cached process detail with normalized schema', function () {
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('processStatus', 'ready')
            ->where('process.id', 'conduit')
            ->has('formSchema.fields.melt_composition'));
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
