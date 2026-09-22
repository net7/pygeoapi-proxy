<?php

use App\Actions\Ogc\StoreProcessResult;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use App\Services\Ogc\ProcessExecutionStorage;
use GuzzleHttp\Psr7\Response as Psr7Response;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('admins see the current local files and input snapshot for another users job', function () {
    $disk = Storage::fake('local');
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->create([
        'input_snapshot' => ['inputsPath' => 'ogc/input-snapshots/job-input.json'],
    ]);
    $directory = "ogc-results/{$execution->id}";
    $disk->put("{$directory}/map.tif", str_repeat('x', 1024));
    $disk->put("{$directory}/nested/data.csv", 'abc');
    $disk->put("{$directory}/.hidden", 'hi');
    $disk->put("{$directory}/empty.txt", '');
    $disk->makeDirectory("{$directory}/empty-folder");
    $disk->put('ogc/input-snapshots/job-input.json', '12345');
    $disk->put('ogc/input-snapshots/other-job.json', 'not this job');
    $disk->put('ogc-results/999999/private.txt', 'another job');
    ProcessExecutionResult::factory()->for($execution)->create([
        'storage_path' => "{$directory}/map.tif",
        'size_bytes' => 9999,
    ]);

    $response = $this->actingAs($admin)->getJson(route('jobs.storage', $execution));

    $response->assertOk()
        ->assertJsonPath('totalSizeBytes', 1034)
        ->assertJsonPath('fileCount', 5)
        ->assertJsonCount(2, 'roots')
        ->assertJsonPath('roots.0.path', $directory)
        ->assertJsonPath('roots.0.type', 'directory')
        ->assertJsonPath('roots.0.sizeBytes', 1029)
        ->assertJsonPath('roots.0.children.0.name', 'empty-folder')
        ->assertJsonPath('roots.0.children.0.children', [])
        ->assertJsonPath('roots.0.children.1.name', 'nested')
        ->assertJsonPath('roots.0.children.1.sizeBytes', 3)
        ->assertJsonPath('roots.0.children.1.children.0.path', "{$directory}/nested/data.csv")
        ->assertJsonPath('roots.1.path', 'ogc/input-snapshots')
        ->assertJsonPath('roots.1.sizeBytes', 5)
        ->assertJsonCount(1, 'roots.1.children')
        ->assertJsonPath('roots.1.children.0.name', 'job-input.json')
        ->assertJsonMissing(['name' => 'other-job.json'])
        ->assertJsonMissing(['name' => 'private.txt']);

    $disk->put("{$directory}/map.tif", 'x');
    $disk->delete("{$directory}/nested/data.csv");

    $this->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 8)
        ->assertJsonPath('fileCount', 4);
});

test('only admins have permission to inspect job storage', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($owner)->create();

    expect($owner->can('viewStorage', $execution))->toBeFalse()
        ->and($otherUser->can('viewStorage', $execution))->toBeFalse()
        ->and($admin->can('viewStorage', $execution))->toBeTrue();

    $this->actingAs($owner)->getJson(route('jobs.storage', $execution))->assertForbidden();
});

test('guests cannot inspect job storage', function () {
    $execution = ProcessExecution::factory()->create();

    $this->getJson(route('jobs.storage', $execution))->assertUnauthorized();
});

test('the job detail exposes storage access only to admins', function () {
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create();

    $this->actingAs($owner)->get(route('jobs.show', $execution))
        ->assertInertia(fn (Assert $page) => $page->where('execution.canViewStorage', false));

    $this->actingAs(User::factory()->admin()->create())->get(route('jobs.show', $execution))
        ->assertInertia(fn (Assert $page) => $page->where('execution.canViewStorage', true));
});

test('missing files and inline inputs use no local file storage', function () {
    Storage::fake('local');
    $execution = ProcessExecution::factory()->create([
        'input_snapshot' => ['inputsPath' => 'ogc/input-snapshots/missing.json'],
    ]);
    ProcessExecutionResult::factory()->for($execution)->create([
        'storage_path' => "ogc-results/{$execution->id}/missing.tif",
        'size_bytes' => 1000,
    ]);

    $this->actingAs(User::factory()->admin()->create())
        ->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 0)
        ->assertJsonPath('databaseResultCount', 0)
        ->assertJsonPath('fileCount', 0)
        ->assertJsonCount(1, 'roots')
        ->assertJsonPath('roots.0.children', []);

    $execution->update(['input_snapshot' => ['inputs' => ['value' => 'inline']]]);

    $this->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 0);
});

test('database results are identified without counting their data as local files', function () {
    $disk = Storage::fake('local');
    $execution = ProcessExecution::factory()->create();
    app(StoreProcessResult::class)->fromResponse($execution, new Response(
        new Psr7Response(200, ['Content-Type' => 'application/json'], '{"answer":42}'),
    ), 'result');

    $this->assertDatabaseHas('process_execution_results', [
        'process_execution_id' => $execution->id,
        'cache_status' => 'cached',
        'storage_path' => null,
    ]);

    $this->actingAs(User::factory()->admin()->create())
        ->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 0)
        ->assertJsonPath('fileCount', 0)
        ->assertJsonPath('databaseResultCount', 1);

    $disk->put("ogc-results/{$execution->id}/output.txt", 'abc');

    $this->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 3)
        ->assertJsonPath('fileCount', 1)
        ->assertJsonPath('databaseResultCount', 1);
});

test('storage inspection never follows symbolic links to unrelated files', function () {
    $disk = Storage::fake('local');
    $execution = ProcessExecution::factory()->create([
        'input_snapshot' => ['inputsPath' => 'ogc/input-snapshots/linked.json'],
    ]);
    $directory = "ogc-results/{$execution->id}";
    $disk->put("{$directory}/own.txt", 'own');
    $disk->put('unrelated/secret.txt', 'private');
    $disk->makeDirectory('ogc/input-snapshots');
    symlink($disk->path('unrelated'), $disk->path("{$directory}/linked-directory"));
    symlink($disk->path('unrelated/secret.txt'), $disk->path("{$directory}/linked.txt"));
    symlink($disk->path('unrelated/secret.txt'), $disk->path('ogc/input-snapshots/linked.json'));

    $this->actingAs(User::factory()->admin()->create())
        ->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 3)
        ->assertJsonPath('fileCount', 1)
        ->assertJsonCount(1, 'roots')
        ->assertJsonCount(1, 'roots.0.children')
        ->assertJsonPath('roots.0.children.0.name', 'own.txt');
});

test('input snapshot paths cannot escape their storage directory', function (string $path) {
    $disk = Storage::fake('local');
    $disk->put('secret.json', 'private');
    $execution = ProcessExecution::factory()->create([
        'input_snapshot' => ['inputsPath' => $path],
    ]);

    $this->actingAs(User::factory()->admin()->create())
        ->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 0)
        ->assertJsonCount(1, 'roots');
})->with(['secret.json', 'ogc/input-snapshots/../../secret.json', '/etc/passwd']);

test('filesystem failures return a retryable response without exposing server paths', function () {
    Exceptions::fake();
    $execution = ProcessExecution::factory()->create();
    $failure = new RuntimeException('Cannot read /private/server/path');
    $this->mock(ProcessExecutionStorage::class)
        ->shouldReceive('forExecution')
        ->once()
        ->andThrow($failure);

    $this->actingAs(User::factory()->admin()->create())
        ->getJson(route('jobs.storage', $execution))
        ->assertServiceUnavailable()
        ->assertExactJson(['message' => 'Unable to inspect job storage.'])
        ->assertHeader('Cache-Control', 'no-store, private');

    Exceptions::assertReported(fn (RuntimeException $exception): bool => $exception === $failure);
});
