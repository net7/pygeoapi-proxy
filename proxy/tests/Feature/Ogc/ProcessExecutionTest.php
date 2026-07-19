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
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;

afterEach(function () {
    Carbon::setTestNow();
});

test('starting a process creates an async local execution and redirects without remote submission', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    app(OgcProcessCache::class)->putProcess('conduit', $process);

    $payload = [
        'inputs' => conduitExampleInputs(),
        'outputs' => [
            'gas' => [],
        ],
    ];
    $expectedOutputs = [
        'gas' => [
            'transmissionMode' => 'value',
        ],
    ];

    $response = $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), $payload);

    $execution = ProcessExecution::query()->sole();

    $response
        ->assertRedirect(route('jobs.show', $execution))
        ->assertInertiaFlash('toast.title', 'Processo avviato')
        ->assertInertiaFlash('toast.message', 'Il processo è in esecuzione.')
        ->assertInertiaFlash('toast.type', 'success')
        ->assertInertiaFlash('toast.icon', false);

    expect(session('toast'))
        ->not->toHaveKey('details')
        ->not->toHaveKey('note')
        ->not->toHaveKey('description');

    expect($execution->user->is($user))->toBeTrue()
        ->and($execution->process_id)->toBe('conduit')
        ->and($execution->process_title)->toBe($process['title'])
        ->and($execution->execution_mode)->toBe(ExecutionMode::Async)
        ->and($execution->status)->toBe(ExecutionStatus::Submitting)
        ->and($execution->progress)->toBe(0)
        ->and($execution->request_payload['inputs'])->toEqual($payload['inputs'])
        ->and($execution->requested_outputs)->toBe($expectedOutputs)
        ->and($execution->process_outputs)->toBe($process['outputs']);

    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->processExecutionId === $execution->id
        && $job->payload['inputs'] === $payload['inputs']
        && $job->payload['outputs'] === $expectedOutputs);

    Http::assertNothingSent();
})->todo('Deferred point 4: honor the process outputTransmission contract.');

test('starting a process stores an optional user note without sending it to the remote payload', function () {
    Bus::fake();
    Http::preventStrayRequests();
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 10:15:00'));

    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    app(OgcProcessCache::class)->putProcess('conduit', $process);

    $note = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => 'Check calibration before publishing results.'],
                ],
            ],
        ],
    ];

    $payload = [
        'inputs' => conduitExampleInputs(),
        'note' => $note,
        'outputs' => [],
    ];

    $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), $payload);

    $execution = ProcessExecution::query()->sole();

    expect($execution->note)->toBe($note)
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T10:15:00+00:00');

    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->processExecutionId === $execution->id
        && ! array_key_exists('note', $job->payload)
        && $job->payload['inputs'] === $payload['inputs']
        && $job->payload['outputs'] === []);
});

test('starting a process without a note leaves note timestamps empty', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), [
        'inputs' => conduitExampleInputs(),
        'outputs' => [],
    ]);

    $execution = ProcessExecution::query()->sole();

    expect($execution->note)->toBeNull()
        ->and($execution->note_updated_at)->toBeNull();
});

test('starting a process ignores a client requested synchronous mode', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $response = $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), [
        'mode' => 'sync',
        'inputs' => conduitExampleInputs(),
        'outputs' => [],
    ]);

    $execution = ProcessExecution::query()->sole();

    $response
        ->assertRedirect(route('jobs.show', $execution));

    expect($execution->execution_mode)->toBe(ExecutionMode::Async);
});

test('starting a process validates schema exclusive bounds before queueing', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $inputs = conduitExampleInputs();
    $inputs['melt_composition']['value']['sio2'] = 0;

    $this->actingAs($user)
        ->post(route('processes.jobs.store', 'conduit'), ['inputs' => $inputs])
        ->assertInvalid(['inputs.melt_composition.value.sio2']);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
});

test('starting a process rejects inputs outside the advertised service contract', function (
    string $processId,
    Closure $buildInputs,
    string $errorPath,
) {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        $processId,
        ogcFixture("process-{$processId}"),
    );

    $this->actingAs($user)
        ->post(route('processes.jobs.store', $processId), [
            'inputs' => $buildInputs(),
        ])
        ->assertInvalid([$errorPath]);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
})->with([
    'undeclared top level input' => [
        'conduit',
        function (): array {
            $inputs = conduitExampleInputs();
            $inputs['unknown'] = true;

            return $inputs;
        },
        'inputs.unknown',
    ],
    'numeric string' => [
        'conduit',
        function (): array {
            $inputs = conduitExampleInputs();
            $inputs['geometry']['value']['l'] = '4000';

            return $inputs;
        },
        'inputs.geometry.value.l',
    ],
    'blank optional numeric property' => [
        'conduit',
        function (): array {
            $inputs = conduitExampleInputs();
            $inputs['searching_mode'] = [
                'variant' => '1',
                'value' => [
                    ...$inputs['searching_mode']['value'],
                    'dg' => null,
                ],
            ];

            return $inputs;
        },
        'inputs.searching_mode.value.dg',
    ],
    'extra solwcad table cell' => [
        'solwcad',
        function (): array {
            $inputs = ogcFixture('process-solwcad')['examples'][0]['payload_example']['inputs'];
            $inputs['sw.data'][0][] = '1.';

            return $inputs;
        },
        'inputs.sw.data.0',
    ],
    'pybox particle fractions reaching one' => [
        'pybox',
        function (): array {
            $inputs = ogcFixture('process-pybox')['examples'][0]['payload_example']['inputs'];
            $inputs['multiple_values'] = array_fill(0, 10, [
                'eps0' => 0.1,
                'rhos' => 1000,
                'ds' => 0.0001,
            ]);

            return $inputs;
        },
        'inputs.multiple_values',
    ],
]);

test('starting a process does not fall back to pygeoapi when process cache is missing', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $response = $this->actingAs(User::factory()->create())->post(route('processes.jobs.store', 'conduit'), [
        'inputs' => ['lat' => 14.47],
    ]);

    $response->assertStatus(409);

    expect(ProcessExecution::query()->count())->toBe(0);

    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
});

test('starting a process without outputs requests every advertised output', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        'conduit',
        ogcFixture('process-conduit'),
    );

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'conduit'),
        ['inputs' => conduitExampleInputs()],
    )->assertRedirect();

    $execution = ProcessExecution::query()->sole();

    expect($execution->requested_outputs)->toBe(
        expectedConduitOutputRequestsForExecution(),
    );

    Bus::assertDispatched(
        SubmitProcessExecutionJob::class,
        fn (SubmitProcessExecutionJob $job): bool => $job->payload['outputs'] ===
                expectedConduitOutputRequestsForExecution(),
    );
})->todo('Deferred point 4: honor the process outputTransmission contract.');

test('starting a process accepts an explicitly empty output selection', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        'conduit',
        ogcFixture('process-conduit'),
    );

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'conduit'),
        [
            'inputs' => conduitExampleInputs(),
            'outputs' => [],
        ],
    )->assertRedirect();

    $execution = ProcessExecution::query()->sole();

    expect($execution->requested_outputs)->toBe([]);

    Bus::assertDispatched(
        SubmitProcessExecutionJob::class,
        fn (SubmitProcessExecutionJob $job): bool => $job->payload['outputs'] === [],
    );
});

test('starting a process rejects unknown output identifiers and formats', function (
    array $outputs,
    string $errorKey,
) {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $inputs = ogcFixture(
        'process-solwcad',
    )['examples'][0]['payload_example']['inputs'];
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => $inputs,
            'outputs' => $outputs,
        ],
    )->assertInvalid([$errorKey]);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
})->with([
    'unknown output' => [
        ['unknown' => []],
        'outputs.unknown',
    ],
    'unknown format' => [
        [
            'solwcad_out' => [
                'format' => ['mediaType' => 'application/xml'],
            ],
        ],
        'outputs.solwcad_out.format',
    ],
]);

test('starting a process rejects positional outputs and client transmission mode', function (
    array $outputs,
    string $errorKey,
) {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $inputs = ogcFixture(
        'process-solwcad',
    )['examples'][0]['payload_example']['inputs'];
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => $inputs,
            'outputs' => $outputs,
        ],
    )->assertInvalid([$errorKey]);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
})->with([
    'positional list' => [
        [['format' => ['mediaType' => 'application/json']]],
        'outputs',
    ],
    'transmission mode' => [
        ['solwcad_out' => ['transmissionMode' => 'reference']],
        'outputs.solwcad_out',
    ],
]);

test('starting a process rejects malformed output selection structures', function (
    mixed $outputs,
    string $errorKey,
) {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $inputs = ogcFixture(
        'process-solwcad',
    )['examples'][0]['payload_example']['inputs'];
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => $inputs,
            'outputs' => $outputs,
        ],
    )->assertInvalid([$errorKey]);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
})->with([
    'outputs is not an array' => [
        'solwcad_out',
        'outputs',
    ],
    'output configuration is not an array' => [
        ['solwcad_out' => 'application/json'],
        'outputs.solwcad_out',
    ],
    'format is not an array' => [
        ['solwcad_out' => ['format' => 'application/json']],
        'outputs.solwcad_out.format',
    ],
    'format omits media type' => [
        ['solwcad_out' => ['format' => ['encoding' => 'utf-8']]],
        'outputs.solwcad_out.format.mediaType',
    ],
    'media type is not a string' => [
        ['solwcad_out' => ['format' => ['mediaType' => 123]]],
        'outputs.solwcad_out.format.mediaType',
    ],
    'encoding is not a string' => [
        [
            'solwcad_out' => [
                'format' => [
                    'mediaType' => 'application/json',
                    'encoding' => 123,
                ],
            ],
        ],
        'outputs.solwcad_out.format.encoding',
    ],
    'schema is neither a string nor an object' => [
        [
            'solwcad_out' => [
                'format' => [
                    'mediaType' => 'application/json',
                    'schema' => true,
                ],
            ],
        ],
        'outputs.solwcad_out.format.schema',
    ],
    'format has an unexpected key' => [
        [
            'solwcad_out' => [
                'format' => [
                    'mediaType' => 'application/json',
                    'label' => 'JSON',
                ],
            ],
        ],
        'outputs.solwcad_out.format',
    ],
]);

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
        && $request['outputs'] instanceof stdClass
        && get_object_vars($request['outputs']) === $payload['outputs']);
});

test('it completes a synchronous zero output execution without storing results', function () {
    Http::preventStrayRequests();

    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    $payload = [
        'inputs' => [
            'melt_composition' => [
                'value' => ['sio2' => 0.7, 'tio2' => 0.01],
            ],
        ],
        'outputs' => [],
    ];
    $execution = app(CreateProcessExecution::class)->handle(
        $user,
        $process,
        $payload,
        ExecutionMode::Sync,
    );

    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/processes/conduit/execution' => Http::response(ogcFixture('chart-result')),
    ]);

    $execution = app(SubmitProcessExecution::class)->handle(
        $execution,
        $payload,
    );

    expect($execution->status)->toBe(ExecutionStatus::Successful)
        ->and($execution->requested_outputs)->toBe([])
        ->and($execution->results)->toHaveCount(0);

    Http::assertSentCount(1);
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
        ->and($execution->process_outputs['dem']['schema']['type'])->toBe('object')
        ->and($execution->process_outputs['dem']['schema']['properties'])->toHaveKeys(['geotiff', 'sld']);
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

test('starting solwcad returns the selected variant field error without queueing', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $row = [
        '1000.',
        '1273.',
        '.0400',
        '.0200',
        '.7653',
        '.0032',
        '.1201',
        '.0027',
        '.0246',
        '.0006',
        '.0018',
        '.0132',
        '.0378',
        '.0306',
    ];

    $response = $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => [
                'swinput.data' => [
                    'variant' => '1',
                    'value' => [
                        'ndat1' => 1,
                        'kl' => 1,
                    ],
                ],
                'sw.data' => [$row],
            ],
        ],
    );

    $response
        ->assertInvalid(['inputs.swinput.data.value.iopen'])
        ->assertValid(['inputs.swinput.data.value.ndat2']);

    expect(ProcessExecution::query()->count())->toBe(0);
    Bus::assertNotDispatched(SubmitProcessExecutionJob::class);
    Http::assertNothingSent();
});

test('starting solwcad strips variant metadata from the stored and queued payload', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess(
        'solwcad',
        ogcFixture('process-solwcad'),
    );

    $row = [
        '1000.',
        '1273.',
        '.0400',
        '.0200',
        '.7653',
        '.0032',
        '.1201',
        '.0027',
        '.0246',
        '.0006',
        '.0018',
        '.0132',
        '.0378',
        '.0306',
    ];
    $selectedValue = [
        'ndat1' => 1,
        'kl' => 1,
        'iopen' => 0,
    ];

    $this->actingAs($user)->post(
        route('processes.jobs.store', 'solwcad'),
        [
            'inputs' => [
                'swinput.data' => [
                    'variant' => '1',
                    'value' => $selectedValue,
                ],
                'sw.data' => [$row],
            ],
        ],
    )->assertRedirect();

    $execution = ProcessExecution::query()->sole();

    expect($execution->request_payload['inputs']['swinput.data'])
        ->toBe(['value' => $selectedValue]);

    Bus::assertDispatched(
        SubmitProcessExecutionJob::class,
        fn (SubmitProcessExecutionJob $job): bool => $job->payload['inputs']['swinput.data'] === ['value' => $selectedValue]
            && ! array_key_exists(
                'variant',
                $job->payload['inputs']['swinput.data'],
            ),
    );
    Http::assertNothingSent();
});

function conduitExampleInputs(): array
{
    return ogcFixture('process-conduit')['examples'][0]['payload_example']['inputs'];
}

function expectedConduitOutputRequestsForExecution(): array
{
    return [
        'gas' => ['transmissionMode' => 'value'],
        'velocity' => ['transmissionMode' => 'value'],
        'pressure' => ['transmissionMode' => 'value'],
        'outfile' => [
            'format' => ['mediaType' => 'text/csv; header=present'],
            'transmissionMode' => 'value',
        ],
        'exit' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
    ];
}
