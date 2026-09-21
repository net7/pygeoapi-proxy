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
});

test('it uses value for every pybox output when references are unsupported', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-pybox'),
    );

    expect($outputs)->toBe([
        'input_data' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
        'dem' => [
            'format' => ['mediaType' => 'application/json'],
            'transmissionMode' => 'value',
        ],
        'invasion_map' => [
            'format' => ['mediaType' => 'application/json'],
            'transmissionMode' => 'value',
        ],
        'spatial_evolution' => [
            'format' => ['mediaType' => 'application/json', 'schema' => '#/$defs/chart'],
            'transmissionMode' => 'value',
        ],
        'deposit_thickness' => [
            'format' => ['mediaType' => 'application/json', 'schema' => '#/$defs/chart'],
            'transmissionMode' => 'value',
        ],
    ]);
});

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
});

test('it chooses a plain text output when the selection is explicitly empty', function () {
    expect(app(ProcessOutputRequestBuilder::class)->forProcess(
        ogcFixture('process-conduit'),
        [],
    ))->toBe([
        'exit' => [
            'format' => ['mediaType' => 'text/plain'],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it preserves selected references when another selected output already uses value', function () {
    $process = ogcFixture('process-conduit');
    $process['outputTransmission'] = ['value', 'reference'];

    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess($process, [
        'outfile' => ['format' => ['mediaType' => 'text/csv; header=present']],
        'exit' => [],
    ]);

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

test('it promotes a selected text output without changing its requested format', function () {
    $process = [
        'outputTransmission' => ['value', 'reference'],
        'outputs' => [
            'raster' => ['schema' => ['contentMediaType' => 'image/tiff']],
            'table' => ['schema' => ['oneOf' => [
                ['contentMediaType' => 'application/octet-stream'],
                [
                    'contentMediaType' => 'text/csv; header=present',
                    'contentEncoding' => 'utf-8',
                    'contentSchema' => 'https://example.test/table',
                ],
            ]]],
            'unselected' => ['schema' => ['contentMediaType' => 'text/plain']],
        ],
    ];

    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess($process, [
        'raster' => [],
        'table' => ['format' => [
            'schema' => 'https://example.test/table',
            'encoding' => 'utf-8',
            'mediaType' => 'text/csv; header=present',
        ]],
    ]);

    expect($outputs)->toBe([
        'raster' => [
            'format' => ['mediaType' => 'image/tiff'],
            'transmissionMode' => 'reference',
        ],
        'table' => [
            'format' => [
                'mediaType' => 'text/csv; header=present',
                'encoding' => 'utf-8',
                'schema' => 'https://example.test/table',
            ],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it promotes the first binary output when no lighter output is available', function (?array $selection, array $expected) {
    $process = [
        'outputTransmission' => ['value', 'reference'],
        'outputs' => [
            'raster' => ['schema' => ['contentMediaType' => 'image/tiff']],
            'archive' => ['schema' => ['contentMediaType' => 'application/zip']],
        ],
    ];

    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess($process, $selection);

    expect($outputs)->toBe($expected);
})->with([
    'explicitly empty selection' => [[], [
        'raster' => [
            'format' => ['mediaType' => 'image/tiff'],
            'transmissionMode' => 'value',
        ],
    ]],
    'omitted selection' => [null, [
        'raster' => [
            'format' => ['mediaType' => 'image/tiff'],
            'transmissionMode' => 'value',
        ],
        'archive' => [
            'format' => ['mediaType' => 'application/zip'],
            'transmissionMode' => 'reference',
        ],
    ]],
]);

test('it prefers a json output over a binary output when the selection is empty', function () {
    $process = [
        'outputTransmission' => ['value', 'reference'],
        'outputs' => [
            'raster' => ['schema' => ['contentMediaType' => 'image/tiff']],
            'summary' => ['schema' => ['type' => 'object']],
        ],
    ];

    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess($process, []);

    expect($outputs)->toBe([
        'summary' => [
            'format' => ['mediaType' => 'application/json'],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it guarantees a value output when transmission capabilities are omitted', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess([
        'outputs' => ['raster' => ['schema' => ['contentMediaType' => 'image/tiff']]],
    ], ['raster' => []]);

    expect($outputs)->toBe([
        'raster' => [
            'format' => ['mediaType' => 'image/tiff'],
            'transmissionMode' => 'value',
        ],
    ]);
});

test('it rejects processes that cannot provide a value output', function (array $process, string $message) {
    try {
        app(ProcessOutputRequestBuilder::class)->forProcess($process);
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe(['outputs' => [$message]]);

        return;
    }

    $this->fail('Expected an output availability validation error.');
})->with([
    'no advertised outputs' => [
        ['outputs' => []],
        'This process does not provide any outputs.',
    ],
    'missing outputs' => [
        [],
        'This process does not provide any outputs.',
    ],
    'reference-only process' => [
        [
            'outputTransmission' => ['reference'],
            'outputs' => ['result' => ['schema' => ['contentMediaType' => 'text/plain']]],
        ],
        'This process does not support returning output values.',
    ],
    'empty transmission capabilities' => [
        [
            'outputTransmission' => [],
            'outputs' => ['result' => ['schema' => ['contentMediaType' => 'text/plain']]],
        ],
        'This process does not support returning output values.',
    ],
]);

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
        'gas' => [
            'format' => ['mediaType' => 'application/json', 'schema' => '#/$defs/chart'],
            'transmissionMode' => 'value',
        ],
        'velocity' => [
            'format' => ['mediaType' => 'application/json', 'schema' => '#/$defs/chart'],
            'transmissionMode' => 'value',
        ],
        'pressure' => [
            'format' => ['mediaType' => 'application/json', 'schema' => '#/$defs/chart'],
            'transmissionMode' => 'value',
        ],
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
