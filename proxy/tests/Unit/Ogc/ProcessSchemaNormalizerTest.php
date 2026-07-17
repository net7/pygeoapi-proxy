<?php

use App\Services\Ogc\ProcessSchemaNormalizer;
use Tests\TestCase;

uses(TestCase::class);

test('it normalizes scalar object and enum fields', function () {
    $process = ogcFixture('process-conduit');

    $normalized = app(ProcessSchemaNormalizer::class)->normalize($process);

    expect($normalized['id'])->toBe('conduit')
        ->and($normalized['jobControlOptions'])->toBe(['async-execute', 'sync-execute'])
        ->and($normalized['fields']['melt_composition']['kind'])->toBe('object')
        ->and($normalized['fields']['melt_composition']['fields']['sio2']['kind'])->toBe('scalar')
        ->and($normalized['fields']['geometry']['fields']['g']['kind'])->toBe('enum')
        ->and($normalized['outputs']['gas']['mediaType'])->toBe('application/json');
});

test('it normalizes one of variants', function () {
    $process = ogcFixture('process-conduit');

    $field = app(ProcessSchemaNormalizer::class)->normalize($process)['fields']['searching_mode'];

    expect($field['kind'])->toBe('oneOf')
        ->and($field['variants'])->toHaveCount(2)
        ->and($field['variants'][0]['fields'])->toHaveKey('d')
        ->and($field['variants'][1]['fields'])->toHaveKey('f');
});

test('it normalizes live conduit inputs and outputs', function () {
    $normalized = app(ProcessSchemaNormalizer::class)->normalize(ogcFixture('process-conduit'));

    expect($normalized['fields'])->toHaveKeys([
        'melt_composition',
        'volatiles',
        'crystals',
        'fragmentation',
        'pressure_temperature',
        'geometry',
        'searching_mode',
    ])
        ->and($normalized['outputs'])->toHaveKeys(['gas', 'velocity', 'pressure', 'outfile', 'exit'])
        ->and(array_column($normalized['fields']['searching_mode']['variants'], 'label'))->toBe([
            '[placeholder per titolo 1]',
            '[placeholder per titolo 2]',
        ]);
});

test('it normalizes live pybox inputs and outputs', function () {
    $normalized = app(ProcessSchemaNormalizer::class)->normalize(ogcFixture('process-pybox'));

    expect($normalized['fields'])->toHaveKeys([
        'lat',
        'lon',
        'l0',
        'h0',
        'theta0',
        'multiple_values',
        'dt',
        'margin',
    ])
        ->and($normalized['outputs'])->toHaveKeys([
            'input_data',
            'dem',
            'invasion_map',
            'spatial_evolution',
            'deposit_thickness',
        ])
        ->and($normalized['fields']['multiple_values']['kind'])->toBe('array_object')
        ->and($normalized['fields']['multiple_values']['minItems'])->toBe(1)
        ->and($normalized['fields']['multiple_values']['maxItems'])->toBe(21)
        ->and($normalized['fields']['multiple_values']['fields'])->toHaveKeys(['eps0', 'rhos', 'ds'])
        ->and($normalized['outputs']['dem']['schemaType'])->toBe('object')
        ->and($normalized['outputs']['dem']['mediaType'])->toBe('image/tiff; application=geotiff')
        ->and($normalized['outputs']['dem']['components'])->toHaveKeys(['geotiff', 'sld'])
        ->and($normalized['outputs']['invasion_map']['schemaType'])->toBe('object')
        ->and($normalized['outputs']['invasion_map']['mediaType'])->toBe('image/tiff; application=geotiff')
        ->and($normalized['outputs']['invasion_map']['components']['sld']['mediaType'])->toBe('application/vnd.ogc.sld+xml');
});

test('it keeps long one of descriptions out of compact index free labels', function () {
    $process = [
        'id' => 'description-only',
        'inputs' => [
            'mode' => [
                'schema' => [
                    'type' => 'object',
                    'oneOf' => [
                        [
                            'description' => str_repeat('Long variant description ', 12),
                            'properties' => [
                                'value' => ['type' => 'integer'],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $variant = app(ProcessSchemaNormalizer::class)
        ->normalize($process)['fields']['mode']['variants'][0];

    expect($variant['label'])->toBe('Variant')
        ->and($variant['label'])->not->toContain('1')
        ->and($variant['description'])->toStartWith('Long variant description');
});

test('it uses a short one of description when no title is available', function () {
    $process = [
        'id' => 'short-description',
        'inputs' => [
            'mode' => [
                'schema' => [
                    'oneOf' => [
                        [
                            'description' => 'Pressure sweep',
                            'properties' => [],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $variant = app(ProcessSchemaNormalizer::class)
        ->normalize($process)['fields']['mode']['variants'][0];

    expect($variant['label'])->toBe('Pressure sweep');
});

test('it preserves advertised one of variant titles', function () {
    $field = app(ProcessSchemaNormalizer::class)
        ->normalize(ogcFixture('process-solwcad'))['fields']['swinput.data'];

    expect($field['variants'])->toHaveCount(4)
        ->and(array_column($field['variants'], 'label'))->toBe([
            '[placeholder per titolo 1]',
            '[placeholder per titolo 2]',
            '[placeholder per titolo 3]',
            '[placeholder per titolo 4]',
        ]);
});

test('it normalizes array tables', function () {
    $process = ogcFixture('process-solwcad');
    $normalized = app(ProcessSchemaNormalizer::class)->normalize($process);

    $field = $normalized['fields']['sw.data'];

    expect($field['kind'])->toBe('array_table')
        ->and($field['minItems'])->toBe(1)
        ->and($field['columns'])->toHaveCount(14)
        ->and(array_column($field['columns'], 'required'))
        ->toBe(array_fill(0, 14, true))
        ->and($field['columns'][0]['pattern'])->toBe('^([+-]?([\d]+\.|[\d]*\.[\d]+))([Dd][+-]?[\d]+)?$')
        ->and($normalized['outputs']['solwcad_out']['mediaType'])->toBe('application/json');
});

test('it normalizes ordered selectable output formats from solwcad', function () {
    $normalized = app(ProcessSchemaNormalizer::class)->normalize(
        ogcFixture('process-solwcad'),
    );

    expect($normalized['outputs']['solwcad_out']['formats'])->toBe([
        [
            'label' => 'JSON Array',
            'mediaType' => 'application/json',
        ],
        [
            'label' => 'Plain text Array',
            'mediaType' => 'text/plain',
        ],
    ])->and($normalized['outputs']['solwcad_out']['mediaType'])
        ->toBe('application/json');
});

test('it normalizes repeatable object arrays', function () {
    $process = ogcFixture('process-pybox');

    $field = app(ProcessSchemaNormalizer::class)->normalize($process)['fields']['multiple_values'];

    expect($field['kind'])->toBe('array_object')
        ->and($field['fields'])->toHaveKeys(['eps0', 'rhos', 'ds'])
        ->and($field['maxItems'])->toBe(21);
});

test('it attaches configured reference datasets to top level inputs', function () {
    config()->set('services.ogc_processes.input_references', [
        'solwcad' => [
            'sw.data' => [
                ['label' => 'Example CSV', 'href' => 'https://example.test/sw.csv', 'mediaType' => 'text/csv'],
            ],
        ],
    ]);

    $normalized = app(ProcessSchemaNormalizer::class)->normalize(ogcFixture('process-solwcad'));

    expect($normalized['fields']['sw.data']['references'])
        ->toBe([
            ['label' => 'Example CSV', 'href' => 'https://example.test/sw.csv', 'mediaType' => 'text/csv'],
        ]);
});
