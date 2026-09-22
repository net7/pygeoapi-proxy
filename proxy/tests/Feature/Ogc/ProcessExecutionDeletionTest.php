<?php

use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
        'inertia.ssr.enabled' => false,
    ]);
});

test('owners can delete their remote job and local results', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123' => Http::response(null, 204),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-123',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
    $this->assertDatabaseMissing('process_execution_results', [
        'id' => $result->id,
    ]);

    Http::assertSent(fn (Request $request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/jobs/job-123');
});

test('remote missing jobs are treated as deleted', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/missing-job' => Http::response([
            'description' => 'Job not found.',
        ], 404),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'missing-job',
    ]);

    $this->actingAs($user)
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
});

test('remote deletion failures keep the local job', function () {
    $disk = Storage::fake('local');
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-500' => Http::response([
            'description' => 'Remote service unavailable.',
        ], 500),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-500',
    ]);
    $path = "ogc-results/{$execution->id}/output.txt";
    $disk->put($path, 'keep');

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.show', $execution));

    $this->assertDatabaseHas('process_executions', [
        'id' => $execution->id,
        'remote_job_id' => 'job-500',
    ]);
    $disk->assertExists($path);
});

test('deletion frees the inspected result files and inputs without touching other jobs', function () {
    $disk = Storage::fake('local');
    Http::preventStrayRequests();
    $admin = User::factory()->admin()->create();
    $snapshot = 'ogc/input-snapshots/delete-job.json';
    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => null,
        'input_snapshot' => ['inputsPath' => $snapshot],
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create();
    $directory = "ogc-results/{$execution->id}";
    $disk->put("{$directory}/nested/output.txt", 'result');
    $disk->put($snapshot, 'data');
    $disk->put('ogc-results/999999/other.txt', 'keep');
    $disk->put('ogc/input-snapshots/other-job.json', 'keep');
    symlink($disk->path('ogc-results/999999'), $disk->path("{$directory}/linked-directory"));

    $this->actingAs($admin)->getJson(route('jobs.storage', $execution))
        ->assertOk()
        ->assertJsonPath('totalSizeBytes', 10);

    $this->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.index'));

    $disk->assertMissing([$directory, $snapshot]);
    $disk->assertExists(['ogc-results/999999/other.txt', 'ogc/input-snapshots/other-job.json']);
    $this->assertDatabaseMissing('process_executions', ['id' => $execution->id]);
    $this->assertDatabaseMissing('process_execution_results', ['id' => $result->id]);
    Http::assertNothingSent();
});

test('deletion does not follow a job directory that links to unrelated files', function () {
    $disk = Storage::fake('local');
    Http::preventStrayRequests();
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => null]);
    $disk->put('unrelated/keep.txt', 'private');
    $disk->makeDirectory('ogc-results');
    symlink($disk->path('unrelated'), $disk->path("ogc-results/{$execution->id}"));

    $this->actingAs($user)->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.index'));

    $disk->assertExists('unrelated/keep.txt');
    $this->assertDatabaseMissing('process_executions', ['id' => $execution->id]);
    Http::assertNothingSent();
});

test('a filesystem cleanup failure keeps the job available instead of reporting deletion', function () {
    $disk = Storage::fake('local');
    Exceptions::fake();
    Http::preventStrayRequests();
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => null]);
    $directory = "ogc-results/{$execution->id}";
    $disk->put("{$directory}/keep.txt", 'keep');
    $failingDisk = Mockery::mock($disk);
    $failingDisk->shouldReceive('deleteDirectory')->with($directory)->once()->andReturn(false);
    Storage::shouldReceive('disk')->with('local')->andReturn($failingDisk);

    $this->actingAs($user)->deleteJson(route('jobs.destroy', $execution))->assertServerError();

    $this->assertDatabaseHas('process_executions', ['id' => $execution->id]);
    $disk->assertExists("{$directory}/keep.txt");
    Http::assertNothingSent();
    Exceptions::assertReported(fn (RuntimeException $exception): bool => $exception->getMessage() === 'Unable to delete job result files.');
});

test('users cannot delete another users job', function () {
    Http::fake();

    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'remote_job_id' => 'owned-job',
    ]);

    $this->actingAs($otherUser)
        ->delete(route('jobs.destroy', $execution))
        ->assertForbidden();

    $this->assertDatabaseHas('process_executions', [
        'id' => $execution->id,
    ]);

    Http::assertNothingSent();
});

test('admins can delete another users job from the admin list', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/admin-job' => Http::response(null, 204),
    ]);

    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'remote_job_id' => 'admin-job',
    ]);

    $this->actingAs($admin)
        ->from(route('admin.jobs.index'))
        ->delete(route('jobs.destroy', [
            'processExecution' => $execution,
            'redirect' => 'back',
        ]))
        ->assertRedirect(route('admin.jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
});

test('local only jobs delete without a remote request', function () {
    Http::fake();

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => null,
    ]);

    $this->actingAs($user)
        ->from(route('jobs.index'))
        ->delete(route('jobs.destroy', [
            'processExecution' => $execution,
            'redirect' => 'back',
        ]))
        ->assertRedirect(route('jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);

    Http::assertNothingSent();
});

test('owners can bulk delete their jobs', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/bulk-remote' => Http::response(null, 204),
        'https://voice.pi.ingv.it/geoinquire/jobs/bulk-missing' => Http::response([
            'description' => 'Missing',
        ], 404),
    ]);

    $user = User::factory()->create();
    $remoteExecution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'bulk-remote',
    ]);
    $missingExecution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'bulk-missing',
    ]);
    $localExecution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => null,
    ]);
    $result = ProcessExecutionResult::factory()->for($remoteExecution)->create();

    $this->actingAs($user)
        ->from(route('jobs.index'))
        ->delete(route('jobs.bulk-destroy'), [
            'ids' => [
                $remoteExecution->id,
                $missingExecution->id,
                $localExecution->id,
            ],
        ])
        ->assertRedirect(route('jobs.index'))
        ->assertInertiaFlash('toast.title', 'Jobs deleted')
        ->assertInertiaFlash('toast.details.0.value', '3');

    $this->assertDatabaseMissing('process_executions', [
        'id' => $remoteExecution->id,
    ]);
    $this->assertDatabaseMissing('process_executions', [
        'id' => $missingExecution->id,
    ]);
    $this->assertDatabaseMissing('process_executions', [
        'id' => $localExecution->id,
    ]);
    $this->assertDatabaseMissing('process_execution_results', [
        'id' => $result->id,
    ]);

    Http::assertSent(fn (Request $request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/jobs/bulk-remote');
    Http::assertSent(fn (Request $request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/jobs/bulk-missing');
});

test('users cannot bulk delete another users jobs', function () {
    Http::fake();

    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'remote_job_id' => 'owned-bulk-job',
    ]);

    $this->actingAs($otherUser)
        ->delete(route('jobs.bulk-destroy'), [
            'ids' => [$execution->id],
        ])
        ->assertForbidden();

    $this->assertDatabaseHas('process_executions', [
        'id' => $execution->id,
    ]);

    Http::assertNothingSent();
});

test('admins can bulk delete jobs from the admin list', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/admin-bulk-job' => Http::response(null, 204),
    ]);

    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'remote_job_id' => 'admin-bulk-job',
    ]);

    $this->actingAs($admin)
        ->from(route('admin.jobs.index'))
        ->delete(route('jobs.bulk-destroy'), [
            'ids' => [$execution->id],
        ])
        ->assertRedirect(route('admin.jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
});

test('bulk remote deletion failures keep the failing job available', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/bulk-success' => Http::response(null, 204),
        'https://voice.pi.ingv.it/geoinquire/jobs/bulk-failing' => Http::response([
            'description' => 'Remote service unavailable.',
        ], 500),
    ]);

    $user = User::factory()->create();
    $deletedExecution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'bulk-success',
    ]);
    $failingExecution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'bulk-failing',
    ]);

    $this->actingAs($user)
        ->from(route('jobs.index'))
        ->delete(route('jobs.bulk-destroy'), [
            'ids' => [$deletedExecution->id, $failingExecution->id],
        ])
        ->assertRedirect(route('jobs.index'))
        ->assertInertiaFlash('toast.title', 'Jobs could not be deleted')
        ->assertInertiaFlash('toast.type', 'error');

    $this->assertDatabaseMissing('process_executions', [
        'id' => $deletedExecution->id,
    ]);
    $this->assertDatabaseHas('process_executions', [
        'id' => $failingExecution->id,
        'remote_job_id' => 'bulk-failing',
    ]);
});
