<?php

use App\Services\Ogc\ProcessOutputRequestBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('it defaults to all conduit outputs using the advertised transmission mode', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-conduit'),
    );

    expect($outputs)->toBe(expectedConduitOutputRequestsForBuilder());
})->todo('Deferred point 4: honor the process outputTransmission contract.');

test('it defaults to formats only where pybox advertises a top level media type', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-pybox'),
    );

    expect($outputs)->toBe([
        'input_data' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
        'dem' => ['transmissionMode' => 'value'],
        'invasion_map' => ['transmissionMode' => 'value'],
        'spatial_evolution' => ['transmissionMode' => 'value'],
        'deposit_thickness' => ['transmissionMode' => 'value'],
    ]);
})->todo('Deferred point 4: honor the process outputTransmission contract.');

test('it defaults solwcad to its first available json format', function () {
    $builder = app(ProcessOutputRequestBuilder::class);
    $process = ogcFixture('process-solwcad');

    expect($builder->forProcess($process))->toBe([
        'solwcad_out' => [
            'format' => ['mediaType' => 'application/json'],
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
            'transmissionMode' => 'value',
        ],
        'exit' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
    ]);
})->todo('Deferred point 4: honor the process outputTransmission contract.');

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
