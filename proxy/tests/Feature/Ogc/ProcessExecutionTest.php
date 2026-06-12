<?php

use App\Actions\Ogc\CreateProcessExecution;
use App\Actions\Ogc\SubmitProcessExecution;
use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Jobs\Ogc\SubmitProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

test('starting a process creates a local execution and redirects without remote submission', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    app(OgcProcessCache::class)->putProcess('conduit', $process);

    $payload = [
        'mode' => 'sync',
        'inputs' => ['melt_composition' => ['value' => ['sio2' => 0.7, 'tio2' => 0.01]]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ];

    $response = $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), $payload);

    $execution = ProcessExecution::query()->sole();

    $response
        ->assertRedirect(route('jobs.show', $execution))
        ->assertInertiaFlash('toast.title', 'Process queued')
        ->assertInertiaFlash('toast.type', 'success')
        ->assertInertiaFlash('toast.icon', false)
        ->assertInertiaFlash('toast.details.0.label', 'Process')
        ->assertInertiaFlash('toast.details.0.value', $process['title'])
        ->assertInertiaFlash('toast.details.1.label', 'Local job')
        ->assertInertiaFlash('toast.details.1.value', "#{$execution->id}")
        ->assertInertiaFlash('toast.details.2.label', 'Mode')
        ->assertInertiaFlash('toast.details.2.value', 'sync')
        ->assertInertiaFlash('toast.details.3.label', 'Initial status')
        ->assertInertiaFlash('toast.details.3.value', 'submitting')
        ->assertInertiaFlash('toast.note', 'Remote submission is running in the background. This page will update automatically.');

    expect($execution->user->is($user))->toBeTrue()
        ->and($execution->process_id)->toBe('conduit')
        ->and($execution->process_title)->toBe($process['title'])
        ->and($execution->execution_mode)->toBe(ExecutionMode::Sync)
        ->and($execution->status)->toBe(ExecutionStatus::Submitting)
        ->and($execution->progress)->toBe(0)
        ->and($execution->request_payload['inputs'])->toBe($payload['inputs'])
        ->and($execution->requested_outputs)->toBe($payload['outputs'])
        ->and($execution->process_outputs)->toBe($process['outputs']);

    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->processExecutionId === $execution->id
        && $job->payload['inputs'] === $payload['inputs']
        && $job->payload['outputs'] === $payload['outputs']);

    Http::assertNothingSent();
});

test('starting a process does not fall back to pygeoapi when process cache is missing', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $response = $this->actingAs(User::factory()->create())->post(route('processes.jobs.store', 'conduit'), [
        'mode' => 'async',
        'inputs' => ['lat' => 14.47],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ]);

    $response->assertStatus(409);

    expect(ProcessExecution::query()->count())->toBe(0);

    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
});

test('it creates a submitting local execution with redacted stored payload', function () {
    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');
    $largeInlineValue = str_repeat('A', 2049);
    $payload = [
        'inputs' => ['input_data' => ['value' => $largeInlineValue]],
        'outputs' => ['dem' => ['transmissionMode' => 'value']],
    ];

    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: $payload,
        mode: ExecutionMode::Async,
    );

    expect($execution->status)->toBe(ExecutionStatus::Submitting)
        ->and($execution->progress)->toBe(0)
        ->and($execution->remote_job_id)->toBeNull()
        ->and($execution->submitted_at)->not->toBeNull()
        ->and($execution->request_payload['inputs']['input_data']['value'])->toBe('[redacted inline value]')
        ->and($execution->request_payload['inputs']['input_data']['sizeBytes'])->toBe(2049)
        ->and($execution->requested_outputs)->toBe($payload['outputs'])
        ->and($execution->process_outputs)->toBe($process['outputs']);
});

test('it submits a synchronous execution with the original payload and stores preview result', function () {
    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    $payload = [
        'inputs' => ['melt_composition' => ['value' => ['sio2' => 0.7, 'tio2' => 0.01]]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ];
    $execution = app(CreateProcessExecution::class)->handle($user, $process, $payload, ExecutionMode::Sync);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(ogcFixture('chart-result')),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle($execution, $payload);

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->results)->toHaveCount(1)
        ->and($execution->results->first()->preview['kind'])->toBe('chart');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution'
        && $request['inputs'] === $payload['inputs']
        && $request['outputs'] === $payload['outputs']);
});

test('it submits an asynchronous execution and dispatches polling', function () {
    Bus::fake();

    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');
    $payload = ['inputs' => ['lat' => 14.47], 'outputs' => ['input_data' => ['transmissionMode' => 'value']]];
    $execution = app(CreateProcessExecution::class)->handle($user, $process, $payload, ExecutionMode::Async);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/pybox/execution' => Http::response([], 201, [
            'Location' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-123',
        ]),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle($execution, $payload);

    expect($execution->status)->toBe(ExecutionStatus::Accepted)
        ->and($execution->remote_job_id)->toBe('job-123');

    Bus::assertDispatched(PollProcessExecutionJob::class);
});

test('it stores process output definitions with asynchronous executions', function () {
    $user = User::factory()->create();
    $process = ogcFixture('process-pybox');
    $payload = ['inputs' => ['lat' => 14.47], 'outputs' => ['dem' => ['transmissionMode' => 'value']]];

    $execution = app(CreateProcessExecution::class)->handle(
        user: $user,
        process: $process,
        payload: $payload,
        mode: ExecutionMode::Async,
    );

    expect($execution->process_outputs)
        ->toBe($process['outputs'])
        ->and($execution->process_outputs)->toHaveKey('dem')
        ->and($execution->process_outputs['dem']['schema']['contentMediaType'])->toBe('application/tiff; application=geotiff');
});

test('it stores submission failures on the existing local execution', function () {
    $user = User::factory()->create();
    $payload = ['inputs' => ['bad' => true]];
    $execution = app(CreateProcessExecution::class)->handle($user, ogcFixture('process-conduit'), $payload, ExecutionMode::Sync);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response([
            'code' => 'InvalidParameterValue',
            'description' => 'Bad input',
        ], 500),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle($execution, $payload);

    expect($execution->status)->toBe(ExecutionStatus::SubmissionFailed)
        ->and($execution->request_payload)->toBe($payload)
        ->and($execution->message)->toContain('Bad input');
});

test('submission job ignores missing terminal and already submitted executions', function () {
    Http::fake();

    (new SubmitProcessExecutionJob(999999, ['inputs' => []]))->handle(app(SubmitProcessExecution::class));

    $terminal = ProcessExecution::factory()->create([
        'status' => ExecutionStatus::Successful,
        'remote_job_id' => null,
    ]);

    (new SubmitProcessExecutionJob($terminal->id, ['inputs' => []]))->handle(app(SubmitProcessExecution::class));

    $alreadySubmitted = ProcessExecution::factory()->create([
        'status' => ExecutionStatus::Accepted,
        'remote_job_id' => 'job-123',
    ]);

    (new SubmitProcessExecutionJob($alreadySubmitted->id, ['inputs' => []]))->handle(app(SubmitProcessExecution::class));

    Http::assertNothingSent();
});
