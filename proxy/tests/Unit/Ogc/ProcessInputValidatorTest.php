<?php

use App\Services\Ogc\ProcessInputValidator;
use App\Services\Ogc\ProcessSchemaNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function normalizedOgcFields(string $fixture): array
{
    return app(ProcessSchemaNormalizer::class)->normalize(ogcFixture($fixture))['fields'];
}

test('it requires inputs with min occurs greater than zero', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-conduit'),
        ['melt_composition' => ['value' => ['sio2' => 0.7]]],
    );

    expect($errors)->toHaveKey('inputs.volatiles');
});

test('it validates exclusive numeric bounds', function () {
    $fields = normalizedOgcFields('process-conduit');

    $tooLow = app(ProcessInputValidator::class)->errors($fields, [
        'melt_composition' => ['value' => ['sio2' => 0]],
    ]);
    $tooHigh = app(ProcessInputValidator::class)->errors($fields, [
        'melt_composition' => ['value' => ['sio2' => 1]],
    ]);

    expect($tooLow)->toHaveKey('inputs.melt_composition.value.sio2')
        ->and($tooHigh)->toHaveKey('inputs.melt_composition.value.sio2');
});

test('it validates array item counts', function () {
    $fields = normalizedOgcFields('process-pybox');

    $tooFew = app(ProcessInputValidator::class)->errors($fields, [
        'multiple_values' => [],
    ]);
    $tooMany = app(ProcessInputValidator::class)->errors($fields, [
        'multiple_values' => array_fill(0, 22, ['eps0' => 0.01, 'rhos' => 1000, 'ds' => 0.0001]),
    ]);

    expect($tooFew)->toHaveKey('inputs.multiple_values')
        ->and($tooMany)->toHaveKey('inputs.multiple_values');
});

test('it validates array table cell patterns', function () {
    $fields = normalizedOgcFields('process-solwcad');

    $errors = app(ProcessInputValidator::class)->errors($fields, [
        'sw.data' => [
            ['not-a-number', '1273.', '.0400', '.0200', '.7653', '.0032', '.1201', '.0027', '.0246', '.0006', '.0018', '.0132', '.0378', '.0306'],
        ],
    ]);

    expect($errors)->toHaveKey('inputs.sw.data.0.0');
});

test('it validates only the explicitly selected one of variant', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-solwcad'),
        [
            'swinput.data' => [
                'variant' => '1',
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                ],
            ],
        ],
    );

    expect($errors)
        ->toHaveKey('inputs.swinput.data.value.iopen')
        ->not->toHaveKey('inputs.swinput.data.value.ndat2');
});

test('it requires the value wrapper for an explicitly selected one of variant', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-solwcad'),
        [
            'swinput.data' => [
                'variant' => '1',
                'ndat1' => 1,
                'kl' => 1,
                'iopen' => 0,
            ],
        ],
    );

    expect($errors)->toHaveKey('inputs.swinput.data.value');
});

test('it rejects unknown one of variant identifiers at the selector path', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-solwcad'),
        [
            'swinput.data' => [
                'variant' => '99',
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                    'iopen' => 0,
                ],
            ],
        ],
    );

    expect($errors)->toHaveKey('inputs.swinput.data.variant');
});

test('it accepts legacy one of input only when one fully valid variant matches', function () {
    $fields = normalizedOgcFields('process-solwcad');
    $variantZero = app(ProcessInputValidator::class)->errors($fields, [
        'swinput.data' => [
            'value' => [
                'ndat1' => 1,
                'ndat2' => 1,
                'kl' => 0,
            ],
        ],
    ]);
    $variantNegativeOne = app(ProcessInputValidator::class)->errors($fields, [
        'swinput.data' => [
            'value' => [
                'ndat1' => 1,
                'ndat2' => 1,
                'kl' => -1,
            ],
        ],
    ]);
    $ambiguous = app(ProcessInputValidator::class)->errors([
        'choice' => [
            'kind' => 'oneOf',
            'variants' => [
                [
                    'id' => '0',
                    'required' => ['name'],
                    'fields' => [
                        'name' => [
                            'kind' => 'scalar',
                            'type' => 'string',
                            'required' => true,
                        ],
                    ],
                ],
                [
                    'id' => '1',
                    'required' => ['name'],
                    'fields' => [
                        'name' => [
                            'kind' => 'scalar',
                            'type' => 'string',
                            'required' => true,
                        ],
                    ],
                ],
            ],
        ],
    ], [
        'choice' => [
            'value' => [
                'name' => 'same',
            ],
        ],
    ]);

    expect($variantZero)->not->toHaveKey('inputs.swinput.data')
        ->and($variantNegativeOne)->not->toHaveKey('inputs.swinput.data')
        ->and($ambiguous)->toHaveKey('inputs.choice');
});

test('it rejects legacy one of input when no complete variant matches', function () {
    $errors = app(ProcessInputValidator::class)->errors(
        normalizedOgcFields('process-solwcad'),
        [
            'swinput.data' => [
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                ],
            ],
        ],
    );

    expect($errors)->toHaveKey('inputs.swinput.data');
});

test('it rejects blank required array table cells', function () {
    $fields = normalizedOgcFields('process-solwcad');
    $row = array_fill(0, 14, null);

    $errors = app(ProcessInputValidator::class)->errors($fields, [
        'sw.data' => [$row],
    ]);

    expect($errors)->toHaveKey('inputs.sw.data.0.0');
});
