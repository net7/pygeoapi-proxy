<?php

use App\Actions\Ogc\PollProcessExecution;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

test('it marks successful jobs and stores results', function () {
    Notification::fake();

    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['gas' => ['transmissionMode' => 'value']],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response(ogcFixture('chart-result')),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $execution->refresh();

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->progress)->toBe(100)
        ->and($execution->results)->toHaveCount(1);

    Notification::assertSentTo($execution->user, ProcessExecutionCompleted::class);
});

test('it marks failed jobs and notifies the user', function () {
    Notification::fake();

    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'job-456',
        'status' => ExecutionStatus::Running,
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-456?f=json' => Http::response(ogcFixture('job-failed')),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $execution->refresh();

    expect($execution->status)->toBe(ExecutionStatus::Failed)
        ->and($execution->message)->toContain('InvalidParameterValue');

    Notification::assertSentTo($execution->user, ProcessExecutionCompleted::class);
});

test('it marks missing remote jobs', function () {
    $execution = ProcessExecution::factory()->create([
        'remote_job_id' => 'missing-job',
        'status' => ExecutionStatus::Running,
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/missing-job?f=json' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'missing-job',
        ], 404),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    expect($execution->refresh()->status)->toBe(ExecutionStatus::RemoteMissing);
});
