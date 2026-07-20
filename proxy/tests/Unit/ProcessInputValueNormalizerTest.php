<?php

use App\Services\Ogc\ProcessInputValueNormalizer;

test('it omits optional blank values recursively and preserves meaningful falsy values', function () {
    $fields = [
        'optional_text' => [
            'kind' => 'scalar',
            'type' => 'string',
        ],
        'required_text' => [
            'kind' => 'scalar',
            'type' => 'string',
            'minOccurs' => 1,
        ],
        'enabled' => [
            'kind' => 'scalar',
            'type' => 'boolean',
        ],
        'mode' => [
            'kind' => 'oneOf',
            'minOccurs' => 1,
            'variants' => [
                [
                    'id' => '1',
                    'fields' => [
                        'kl' => [
                            'kind' => 'enum',
                            'required' => true,
                        ],
                        'fopen' => [
                            'kind' => 'scalar',
                            'type' => 'string',
                        ],
                        'iopen' => [
                            'kind' => 'enum',
                        ],
                    ],
                ],
            ],
        ],
    ];

    expect(app(ProcessInputValueNormalizer::class)->normalize($fields, [
        'optional_text' => '   ',
        'required_text' => '',
        'enabled' => false,
        'mode' => [
            'variant' => '1',
            'value' => [
                'kl' => 1,
                'fopen' => '',
                'iopen' => 0,
            ],
        ],
    ]))->toBe([
        'required_text' => '',
        'enabled' => false,
        'mode' => [
            'variant' => '1',
            'value' => [
                'kl' => 1,
                'iopen' => 0,
            ],
        ],
    ]);
});

test('it keeps undeclared inputs and required blank table cells for validation', function () {
    $fields = [
        'table' => [
            'kind' => 'array_table',
            'minOccurs' => 1,
        ],
    ];

    expect(app(ProcessInputValueNormalizer::class)->normalize($fields, [
        'table' => [['']],
        'unexpected' => null,
    ]))->toBe([
        'table' => [['']],
        'unexpected' => null,
    ]);
});
