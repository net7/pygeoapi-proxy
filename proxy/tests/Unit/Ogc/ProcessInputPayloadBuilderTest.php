<?php

use App\Services\Ogc\ProcessInputPayloadBuilder;
use Tests\TestCase;

uses(TestCase::class);

test('it removes only the selected variant marker from one of inputs', function () {
    $fields = [
        'swinput.data' => [
            'kind' => 'oneOf',
        ],
    ];

    $inputs = [
        'swinput.data' => [
            'variant' => '1',
            'value' => [
                'ndat1' => 1,
                'kl' => 1,
                'iopen' => 0,
            ],
        ],
    ];

    expect(app(ProcessInputPayloadBuilder::class)->build($fields, $inputs))
        ->toBe([
            'swinput.data' => [
                'value' => [
                    'ndat1' => 1,
                    'kl' => 1,
                    'iopen' => 0,
                ],
            ],
        ]);
});

test('it preserves non one of OGC input representations', function () {
    $fields = [
        'sw.data' => [
            'kind' => 'array_table',
        ],
        'dataset' => [
            'kind' => 'scalar',
        ],
    ];

    $inputs = [
        'sw.data' => [['1000.', '1273.']],
        'dataset' => [
            'href' => 'https://example.test/data.csv',
            'type' => 'text/csv',
        ],
    ];

    expect(app(ProcessInputPayloadBuilder::class)->build($fields, $inputs))
        ->toBe($inputs);
});
