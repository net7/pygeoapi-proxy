<?php

use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['inertia.ssr.enabled' => false]);
});

test('non admins receive the forbidden page when opening user management', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.users.index'));

    $response->assertForbidden()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/forbidden')
            ->where('authenticated', true)
            ->missing('users'));
});

test('foreign job navigation returns an Inertia 403 without private job details', function () {
    $execution = ProcessExecution::factory()->create(['name' => 'Private volcano analysis']);
    $user = User::factory()->create();
    $manifest = public_path('build/manifest.json');

    $response = $this->actingAs($user)->get(route('jobs.show', $execution), [
        'Accept' => 'text/html, application/xhtml+xml',
        'X-Inertia' => 'true',
        'X-Inertia-Version' => file_exists($manifest) ? hash_file('xxh128', $manifest) : '',
        'X-Requested-With' => 'XMLHttpRequest',
    ]);

    $response->assertForbidden()
        ->assertHeader('X-Inertia', 'true')
        ->assertJsonPath('component', 'errors/forbidden')
        ->assertJsonPath('props.authenticated', true)
        ->assertJsonMissingPath('props.execution')
        ->assertJsonMissingPath('props.results')
        ->assertDontSee('Private volcano analysis');
});

test('forbidden JSON requests keep a plain 403 response', function () {
    config(['app.debug' => false]);
    $user = User::factory()->create();

    $response = $this->actingAs($user)->getJson(route('admin.users.index'));

    $response->assertForbidden()
        ->assertHeader('Content-Type', 'application/json')
        ->assertHeaderMissing('X-Inertia')
        ->assertJsonStructure(['message'])
        ->assertJsonMissingPath('component');
});

test('forbidden AJAX requests keep a plain 403 response', function () {
    config(['app.debug' => false]);
    $execution = ProcessExecution::factory()->create();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('jobs.show', $execution), [
        'Accept' => '*/*',
        'X-Requested-With' => 'XMLHttpRequest',
    ]);

    $response->assertForbidden()
        ->assertHeader('Content-Type', 'application/json')
        ->assertHeaderMissing('X-Inertia')
        ->assertJsonMissingPath('component');
});

test('foreign result requests keep their non Inertia 403 response', function (string $routeName) {
    config(['app.debug' => false]);
    $execution = ProcessExecution::factory()->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route($routeName, [$execution, $result]), [
        'Accept' => 'text/html',
    ]);

    $response->assertForbidden()
        ->assertHeaderMissing('X-Inertia')
        ->assertDontSee('errors/forbidden');
})->with([
    'download' => 'jobs.results.download',
    'preview' => 'jobs.results.preview',
    'map tile' => 'jobs.results.map-tile',
]);

test('guests still redirect to login when opening protected pages', function (string $routeName) {
    $response = $this->get(route($routeName));

    $response->assertRedirectToRoute('login');
})->with(['admin.users.index', 'jobs.index']);

test('the forbidden page can render without shared Inertia middleware data', function () {
    Route::get('/forbidden-without-shared-data', fn () => abort(403));

    $response = $this->get('/forbidden-without-shared-data');

    $response->assertForbidden()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/forbidden')
            ->where('authenticated', false)
            ->missing('auth'));
});
