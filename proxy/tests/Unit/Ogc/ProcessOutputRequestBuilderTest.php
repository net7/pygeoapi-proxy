<?php

use App\Services\Ogc\ProcessOutputRequestBuilder;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

test('it defaults to all conduit outputs with trusted formats and automatic transmission modes', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-conduit'),
    );

    expect($outputs)->toBe(expectedConduitOutputRequestsForBuilder());
});

test('it defaults to formats only where pybox advertises a top level media type', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-pybox'),
    );

    expect($outputs)->toBe([
        'input_data' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
        'dem' => ['transmissionMode' => 'reference'],
        'invasion_map' => ['transmissionMode' => 'reference'],
        'spatial_evolution' => [
            'format' => [
                'mediaType' => 'application/json',
                'schema' => '#/$defs/chart',
            ],
            'transmissionMode' => 'value',
        ],
        'deposit_thickness' => [
            'format' => [
                'mediaType' => 'application/json',
                'schema' => '#/$defs/chart',
            ],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it defaults solwcad to the first format and accepts its second format', function () {
    $builder = app(ProcessOutputRequestBuilder::class);
    $process = ogcFixture('process-solwcad');

    expect($builder->forProcess($process))->toBe([
        'solwcad_out' => [
            'format' => ['mediaType' => 'application/json'],
            'transmissionMode' => 'value',
        ],
    ])->and($builder->forProcess($process, [
        'solwcad_out' => [
            'format' => ['mediaType' => 'text/plain'],
        ],
    ]))->toBe([
        'solwcad_out' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it requests only the selected top level outputs', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-conduit'),
        [
            'outfile' => [
                'format' => ['mediaType' => 'text/csv; header=present'],
            ],
            'exit' => [],
        ],
    );

    expect($outputs)->toBe([
        'outfile' => [
            'format' => ['mediaType' => 'text/csv; header=present'],
            'transmissionMode' => 'reference',
        ],
        'exit' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it accepts an explicitly empty selection', function () {
    expect(app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-conduit'),
        [],
    ))->toBe([]);
});

test('it rejects unknown output identifiers', function () {
    try {
        app(ProcessOutputRequestBuilder::class)->forProcess(
            ogcFixture('process-conduit'),
            ['unknown' => []],
        );
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe([
            'outputs.unknown' => [
                'This output is not available.',
            ],
        ]);

        return;
    }

    $this->fail('Expected an unknown output validation error.');
});

test('it rejects output formats not advertised by the process', function () {
    try {
        app(ProcessOutputRequestBuilder::class)->forProcess(
            ogcFixture('process-solwcad'),
            [
                'solwcad_out' => [
                    'format' => ['mediaType' => 'application/xml'],
                ],
            ],
        );
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe([
            'outputs.solwcad_out.format' => [
                'This output format is not available.',
            ],
        ]);

        return;
    }

    $this->fail('Expected an unknown output format validation error.');
});

function expectedConduitOutputRequestsForBuilder(): array
{
    $chartFormat = [
        'mediaType' => 'application/json',
        'schema' => '#/$defs/chart',
    ];

    return [
        'gas' => [
            'format' => $chartFormat,
            'transmissionMode' => 'value',
        ],
        'velocity' => [
            'format' => $chartFormat,
            'transmissionMode' => 'value',
        ],
        'pressure' => [
            'format' => $chartFormat,
            'transmissionMode' => 'value',
        ],
        'outfile' => [
            'format' => ['mediaType' => 'text/csv; header=present'],
            'transmissionMode' => 'reference',
        ],
        'exit' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
    ];
}
