<?php

use App\Models\ProcessExecution;
use App\Services\Ogc\OgcResultResponseParser;
use GuzzleHttp\Psr7\Response as Psr7Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Response;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('it returns no parsed results for an explicit empty requested output map', function () {
    $execution = ProcessExecution::factory()->make([
        'requested_outputs' => [],
        'process_outputs' => ogcFixture('process-conduit')['outputs'],
    ]);
    $response = new Response(new Psr7Response(
        200,
        ['Content-Type' => 'application/json'],
        json_encode(ogcFixture('chart-result'), JSON_THROW_ON_ERROR),
    ));

    expect(app(OgcResultResponseParser::class)->parse(
        $execution,
        $response,
    ))->toBe([]);
});

test('it retains the historical result fallback when requested outputs are null', function () {
    $execution = ProcessExecution::factory()->make([
        'requested_outputs' => null,
        'process_outputs' => [],
    ]);
    $response = new Response(new Psr7Response(
        200,
        ['Content-Type' => 'application/json'],
        '{"value":42}',
    ));

    $results = app(OgcResultResponseParser::class)->parse(
        $execution,
        $response,
    );

    expect($results)->toHaveCount(1)
        ->and($results[0]['output_id'])->toBe('result');
});

test('it normalizes encoded output metadata before persisting a parsed result', function () {
    $execution = ProcessExecution::factory()->make([
        'requested_outputs' => [
            'solwcad_out' => ['transmissionMode' => 'value'],
        ],
        'process_outputs' => [
            'solwcad_out' => [
                'title' => 'Output &gt; 0',
                'description' => 'Total ( kl &gt0)',
            ],
        ],
    ]);
    $response = new Response(new Psr7Response(
        200,
        ['Content-Type' => 'text/plain'],
        'result body',
    ));

    $results = app(OgcResultResponseParser::class)->parse(
        $execution,
        $response,
        'solwcad_out',
    );

    expect($results[0]['title'])->toBe('Output > 0')
        ->and($results[0]['description'])->toBe('Total ( kl >0)');
});
