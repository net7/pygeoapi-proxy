<?php

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
    ]);
});

test('users can view their execution detail', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->get("/process-executions/{$execution->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('process-executions/show')
            ->where('execution.id', $execution->id)
            ->has('execution.results', 1));
});

test('users cannot view another users execution detail', function () {
    $execution = ProcessExecution::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get("/process-executions/{$execution->id}")
        ->assertForbidden();
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
        ->get("/process-executions/{$execution->id}/results/{$result->id}/download")
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
        ->get("/process-executions/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=utf-8');

    Storage::disk('local')->assertExists("ogc-results/{$execution->id}/outfile");
    expect($result->refresh()->cache_status)->toBe(ResultCacheStatus::Cached);
});
