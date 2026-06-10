<?php

use App\Actions\Ogc\PollProcessExecution;
use App\Enums\Ogc\ExecutionStatus;
use App\Jobs\Ogc\PollProcessExecutionJob;
use App\Models\ProcessExecution;
use App\Notifications\Ogc\ProcessExecutionCompleted;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

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

    Notification::assertSentTo(
        $execution->user,
        ProcessExecutionCompleted::class,
        function (ProcessExecutionCompleted $notification) use ($execution) {
            $data = $notification->toDatabase($execution->user)->data;

            return $data['title'] === 'Process completed'
                && $data['body'] === 'The process finished successfully and the results are ready.'
                && $data['icon'] === 'check-circle'
                && $data['tone'] === 'success'
                && $data['action_url'] === route('jobs.show', $execution);
        },
    );
});

test('it stores each multipart result using process output definitions', function () {
    Notification::fake();
    Storage::fake('local');

    $boundary = 'result-boundary';
    $body = implode("\r\n", [
        '--'.$boundary,
        'Content-Disposition: form-data; name="gas"',
        'Content-Type: application/json',
        '',
        json_encode(ogcFixture('chart-result'), JSON_THROW_ON_ERROR),
        '--'.$boundary,
        'Content-Disposition: form-data; name="outfile"; filename="outfile.csv"',
        'Content-Type: text/csv',
        '',
        "length,gas\r\n0,10\r\n1,20\r\n",
        '--'.$boundary.'--',
        '',
    ]);

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'conduit',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => [
            'gas' => ['transmissionMode' => 'value'],
            'outfile' => ['transmissionMode' => 'value'],
        ],
        'process_outputs' => ogcFixture('process-conduit')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response($body, 200, [
            'Content-Type' => 'multipart/mixed; boundary="'.$boundary.'"',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $execution->refresh();
    $results = $execution->results()->orderBy('output_id')->get()->keyBy('output_id');

    expect($results)->toHaveCount(2)
        ->and($results['gas']->title)->toBe('Plot gas volume fraction')
        ->and($results['gas']->media_type)->toBe('application/json')
        ->and($results['gas']->preview['kind'])->toBe('chart')
        ->and($results['outfile']->title)->toBe('Table of output variables')
        ->and($results['outfile']->media_type)->toBe('text/csv')
        ->and($results['outfile']->preview['kind'])->toBe('csv')
        ->and($results['outfile']->preview['data'])->toContain('length,gas');
});

test('it caches binary multipart results on local storage', function () {
    Notification::fake();
    Storage::fake('local');

    $boundary = 'binary-boundary';
    $body = implode("\r\n", [
        '--'.$boundary,
        'Content-Disposition: form-data; name="invasion_map"; filename="invasion_map.tif"',
        'Content-Type: application/tiff; application=geotiff',
        '',
        'TIFF-BINARY-CONTENT',
        '--'.$boundary.'--',
        '',
    ]);

    $execution = ProcessExecution::factory()->create([
        'process_id' => 'pybox',
        'remote_job_id' => 'job-123',
        'status' => ExecutionStatus::Running,
        'requested_outputs' => ['invasion_map' => ['transmissionMode' => 'value']],
        'process_outputs' => ogcFixture('process-pybox')['outputs'],
    ]);

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123?f=json' => Http::response(ogcFixture('job-successful')),
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123/results?f=json' => Http::response($body, 200, [
            'Content-Type' => 'multipart/mixed; boundary="'.$boundary.'"',
        ]),
    ]);

    (new PollProcessExecutionJob($execution->id))->handle(
        app(PollProcessExecution::class),
    );

    $result = $execution->refresh()->results()->sole();

    expect($result->output_id)->toBe('invasion_map')
        ->and($result->title)->toBe('Invasion Map')
        ->and($result->preview)->toBe([
            'kind' => 'binary',
            'data' => [
                'mediaType' => 'application/tiff',
                'sizeBytes' => strlen('TIFF-BINARY-CONTENT'),
            ],
        ])
        ->and($result->storage_path)->not->toBeNull();

    Storage::disk('local')->assertExists($result->storage_path);
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

    Notification::assertSentTo(
        $execution->user,
        ProcessExecutionCompleted::class,
        function (ProcessExecutionCompleted $notification) use ($execution) {
            $data = $notification->toDatabase($execution->user)->data;

            return $data['title'] === 'Process failed'
                && str_contains($data['body'], 'InvalidParameterValue')
                && $data['icon'] === 'circle-alert'
                && $data['tone'] === 'error'
                && $data['action_url'] === route('jobs.show', $execution);
        },
    );
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
