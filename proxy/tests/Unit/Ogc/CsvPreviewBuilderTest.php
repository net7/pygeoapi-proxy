<?php

use App\Services\Ogc\CsvPreviewBuilder;

test('it builds a structured preview for quoted csv data', function () {
    $preview = (new CsvPreviewBuilder)->fromString(
        "name,description,count\nEtna,\"gas, ash\",3\n\"Quote \"\"inside\"\"\",blank,\n",
    );

    expect($preview)->not->toBeNull()
        ->and($preview['headers'])->toBe(['name', 'description', 'count'])
        ->and($preview['rows'])->toBe([
            ['Etna', 'gas, ash', '3'],
            ['Quote "inside"', 'blank', ''],
        ])
        ->and($preview['truncated'])->toBeFalse()
        ->and($preview['source'])->toContain('gas, ash');
});

test('it preserves irregular rows without throwing', function () {
    $preview = (new CsvPreviewBuilder)->fromString(
        "a,b,c\n1,2\n3,4,5,6\n",
    );

    expect($preview)->not->toBeNull()
        ->and($preview['headers'])->toBe(['a', 'b', 'c'])
        ->and($preview['rows'])->toBe([
            ['1', '2'],
            ['3', '4', '5', '6'],
        ]);
});

test('it marks row-limited previews as truncated', function () {
    $lines = ['a,b'];

    foreach (range(1, 25) as $index) {
        $lines[] = "{$index},value {$index}";
    }

    $preview = (new CsvPreviewBuilder)->fromString(implode("\n", $lines)."\n");

    expect($preview)->not->toBeNull()
        ->and($preview['rows'])->toHaveCount(20)
        ->and($preview['truncated'])->toBeTrue();
});

test('it marks byte-limited previews as truncated', function () {
    $preview = (new CsvPreviewBuilder)->fromString('a,b'."\n".str_repeat('x', CsvPreviewBuilder::MaxBytes + 10));

    expect($preview)->not->toBeNull()
        ->and(strlen($preview['source']))->toBe(CsvPreviewBuilder::MaxBytes)
        ->and($preview['truncated'])->toBeTrue();
});
