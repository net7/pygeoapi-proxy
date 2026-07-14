<?php

use App\Services\Ogc\ProcessOutputRequestBuilder;
use Tests\TestCase;

uses(TestCase::class);

test('it requests text and json outputs by value and file outputs by reference', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(ogcFixture('process-conduit'));

    expect($outputs)->toBe([
        'gas' => ['transmissionMode' => 'value'],
        'velocity' => ['transmissionMode' => 'value'],
        'pressure' => ['transmissionMode' => 'value'],
        'outfile' => ['transmissionMode' => 'reference'],
        'exit' => ['transmissionMode' => 'value'],
    ]);
});

test('it requests object file outputs by reference', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(ogcFixture('process-pybox'));

    expect($outputs)->toBe([
        'input_data' => ['transmissionMode' => 'value'],
        'dem' => ['transmissionMode' => 'reference'],
        'invasion_map' => ['transmissionMode' => 'reference'],
        'spatial_evolution' => ['transmissionMode' => 'value'],
        'deposit_thickness' => ['transmissionMode' => 'value'],
    ]);
});

test('it detects value outputs advertised through one of media schemas', function () {
    $outputs = app(ProcessOutputRequestBuilder::class)->forProcess(ogcFixture('process-solwcad'));

    expect($outputs)->toBe([
        'solwcad_out' => ['transmissionMode' => 'value'],
    ]);
});
