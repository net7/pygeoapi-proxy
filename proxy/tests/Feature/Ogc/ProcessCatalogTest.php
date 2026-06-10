<?php

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();

    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
    ]);
});

test('guests cannot access process catalog', function () {
    $this->get('/processes')->assertRedirect(route('login'));
});

test('authenticated users can view process catalog', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes?f=json' => Http::response(ogcFixture('processes')),
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/processes')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/index')
            ->has('processes', 3));
});

test('authenticated users can view process detail with normalized schema', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('process.id', 'conduit')
            ->has('formSchema.fields.melt_composition'));
});

test('process detail exposes example payload for local environments', function () {
    app()->detectEnvironment(fn (): string => 'local');

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('formSchema.examplePayload.inputs.melt_composition.value.sio2', 0.7669)
            ->where('formSchema.examplePayload.outputs.gas.transmissionMode', 'value'));
});

test('process detail hides example payload outside local environments', function () {
    app()->detectEnvironment(fn (): string => 'production');

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit?f=json' => Http::response(ogcFixture('process-conduit')),
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/processes/conduit')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('processes/show')
            ->where('formSchema.examplePayload', null));
});
