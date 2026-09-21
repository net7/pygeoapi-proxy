<?php

use App\Models\ProcessExecution;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'app.debug' => false,
        'inertia.ssr.enabled' => false,
    ]);
});

test('unknown browser URLs show the not found page without shared middleware data', function () {
    $response = $this->get('/this-page-does-not-exist');

    $response->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/not-found')
            ->where('authenticated', false)
            ->missing('auth'));
});

test('missing jobs show the not found page to authenticated users', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('jobs.show', 999999));

    $response->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/not-found')
            ->where('authenticated', true)
            ->missing('execution'));
});

test('unknown Inertia URLs return a navigable not found response', function () {
    $response = $this->get('/this-page-does-not-exist', [
        'Accept' => 'text/html, application/xhtml+xml',
        'X-Inertia' => 'true',
        'X-Requested-With' => 'XMLHttpRequest',
    ]);

    $response->assertNotFound()
        ->assertHeader('X-Inertia', 'true')
        ->assertJsonPath('component', 'errors/not-found')
        ->assertJsonPath('props.authenticated', false);
});

test('missing JSON and AJAX resources keep a plain 404 response', function (array $headers) {
    $response = $this->get('/this-page-does-not-exist', $headers);

    $response->assertNotFound()
        ->assertHeader('Content-Type', 'application/json')
        ->assertHeaderMissing('X-Inertia')
        ->assertJsonStructure(['message'])
        ->assertJsonMissingPath('component');
})->with([
    'JSON' => [['Accept' => 'application/json']],
    'AJAX' => [['Accept' => '*/*', 'X-Requested-With' => 'XMLHttpRequest']],
]);

test('missing API URLs do not return an Inertia page', function () {
    $response = $this->get('/api/this-resource-does-not-exist', ['Accept' => 'text/html']);

    $response->assertNotFound()
        ->assertHeaderMissing('X-Inertia')
        ->assertDontSee('errors/not-found');
});

test('missing result resources keep their non Inertia 404 response', function (string $routeName) {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $response = $this->actingAs($user)->get(route($routeName, [$execution, 999999]), [
        'Accept' => 'text/html',
    ]);

    $response->assertNotFound()
        ->assertHeaderMissing('X-Inertia')
        ->assertDontSee('errors/not-found');
})->with([
    'download' => 'jobs.results.download',
    'preview' => 'jobs.results.preview',
    'map tile' => 'jobs.results.map-tile',
]);
