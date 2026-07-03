<?php

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
    ]);
});

test('users can view their execution detail', function () {
    config(['services.ogc_processes.polling_interval' => 2500]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
    ]);

    ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->missing('execution.remoteJobId')
            ->where('pollingInterval', 2500)
            ->has('execution.results', 1));
});

test('non admin users cannot see execution input data', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'request_payload' => [
            'inputs' => [
                'melt_composition' => [
                    'value' => ['sio2' => 0.7],
                ],
            ],
        ],
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->missing('execution.requestPayload'));
});

test('admin users can see execution input data and remote job id', function () {
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
        'request_payload' => [
            'inputs' => [
                'melt_composition' => [
                    'value' => ['sio2' => 0.7],
                ],
            ],
        ],
    ]);

    $this->actingAs($admin)
        ->get("/jobs/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->where('execution.remoteJobId', '550e8400-e29b-41d4-a716-446655440000')
            ->where('execution.requestPayload.inputs.melt_composition.value.sio2', 0.7));
});

test('users can view their job list with timeline timestamps', function () {
    Carbon::setTestNow('2026-06-10 12:30:00');
    config(['services.ogc_processes.polling_interval' => 2500]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
        'submitted_at' => now()->subMinutes(8),
        'completed_at' => now()->subMinute(),
        'failed_at' => null,
    ]);

    $this->actingAs($user)
        ->get('/jobs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/index')
            ->where('executions.data.0.id', $execution->id)
            ->missing('executions.data.0.remoteJobId')
            ->where('executions.data.0.submittedAt', now()->subMinutes(8)->toIso8601String())
            ->where('executions.data.0.completedAt', now()->subMinute()->toIso8601String())
            ->where('executions.data.0.failedAt', null)
            ->where('pollingInterval', 2500));
});

test('admin users can view their job list with remote job ids', function () {
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($admin)->create([
        'remote_job_id' => '550e8400-e29b-41d4-a716-446655440000',
    ]);

    $this->actingAs($admin)
        ->get('/jobs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/index')
            ->where('executions.data.0.id', $execution->id)
            ->where('executions.data.0.remoteJobId', '550e8400-e29b-41d4-a716-446655440000'));
});

test('users cannot view another users execution detail', function () {
    $execution = ProcessExecution::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get("/jobs/{$execution->id}")
        ->assertForbidden();
});

test('legacy execution routes redirect to canonical job routes', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get('/process-executions')
        ->assertRedirectToRoute('jobs.index');

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}")
        ->assertRedirectToRoute('jobs.show', $execution);

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}/results/{$result->id}/download")
        ->assertRedirectToRoute('jobs.results.download', [$execution, $result]);
});

test('users can download cached result files', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'outfile',
        'media_type' => 'text/csv',
        'storage_path' => 'ogc-results/outfile.csv',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/outfile.csv', "a,b\n1,2\n");

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=utf-8');
});

test('users can download and cache remote result files on demand', function () {
    Storage::fake('local');
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/outfile' => Http::response("a,b\n1,2\n", 200, [
            'Content-Type' => 'text/csv',
        ]),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-1',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'outfile',
        'media_type' => 'text/csv',
        'remote_href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/outfile',
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::MetadataOnly,
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=utf-8');

    Storage::disk('local')->assertExists("ogc-results/{$execution->id}/outfile");
    expect($result->refresh()->cache_status)->toBe(ResultCacheStatus::Cached);
});
