<?php

use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
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
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-500' => Http::response([
            'description' => 'Remote service unavailable.',
        ], 500),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-500',
    ]);

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.show', $execution));

    $this->assertDatabaseHas('process_executions', [
        'id' => $execution->id,
        'remote_job_id' => 'job-500',
    ]);
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
