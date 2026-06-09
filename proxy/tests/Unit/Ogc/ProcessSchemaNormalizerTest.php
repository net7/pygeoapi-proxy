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

test('it normalizes array tables', function () {
    $process = ogcFixture('process-solwcad');

    $field = app(ProcessSchemaNormalizer::class)->normalize($process)['fields']['sw.data'];

    expect($field['kind'])->toBe('array_table')
        ->and($field['minItems'])->toBe(1)
        ->and($field['columns'])->toHaveCount(14);
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
