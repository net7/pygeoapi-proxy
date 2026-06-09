<?php

use App\Actions\Ogc\StartProcessExecution;
use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

test('it stores a successful synchronous execution with preview result', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(ogcFixture('chart-result')),
    ]);

    $process = ogcFixture('process-conduit');
    $payload = [
        'inputs' => ['melt_composition' => ['sio2' => 0.7, 'tio2' => 0.01]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ];

    $execution = app(StartProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: $payload,
        mode: ExecutionMode::Sync,
    );

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->request_payload)->toBe($payload)
        ->and($execution->results)->toHaveCount(1)
        ->and($execution->results->first()->preview['kind'])->toBe('chart');
});

test('it stores asynchronous execution and dispatches polling', function () {
    Bus::fake();

    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/pybox/execution' => Http::response([], 201, [
            'Location' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123',
        ]),
    ]);

    $execution = app(StartProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: ['inputs' => ['lat' => 14.47], 'outputs' => ['input_data' => ['transmissionMode' => 'value']]],
        mode: ExecutionMode::Async,
    );

    expect($execution->status)->toBe(ExecutionStatus::Accepted)
        ->and($execution->remote_job_id)->toBe('job-123');

    Bus::assertDispatched(PollProcessExecutionJob::class);
});

test('it stores submission failures with original payload', function () {
    $user = User::factory()->create();

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'Bad input',
        ], 500),
    ]);

    $payload = ['inputs' => ['bad' => true]];

    $execution = app(StartProcessExecution::class)->handle(
        user: $user,
        process: ogcFixture('process-conduit'),
        payload: $payload,
        mode: ExecutionMode::Sync,
    );

    expect($execution->status)->toBe(ExecutionStatus::SubmissionFailed)
        ->and($execution->request_payload)->toBe($payload)
        ->and($execution->message)->toContain('Bad input');
});
