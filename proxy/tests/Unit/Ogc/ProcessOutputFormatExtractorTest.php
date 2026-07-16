<?php

use App\Services\Ogc\ProcessOutputFormatExtractor;
use Tests\TestCase;

uses(TestCase::class);

test('it extracts direct output format qualifiers', function () {
    $formats = app(ProcessOutputFormatExtractor::class)->formats([
        'title' => 'GeoJSON document',
        'contentMediaType' => 'application/geo+json',
        'contentEncoding' => 'utf-8',
        'contentSchema' => 'https://example.test/schema/geojson.json',
    ]);

    expect($formats)->toBe([
        [
            'label' => 'GeoJSON document',
            'mediaType' => 'application/geo+json',
            'encoding' => 'utf-8',
            'schema' => 'https://example.test/schema/geojson.json',
        ],
    ]);
});

test('it preserves solwcad one of format order and labels', function () {
    $schema = ogcFixture('process-solwcad')['outputs']['solwcad_out']['schema'];

    expect(app(ProcessOutputFormatExtractor::class)->formats($schema))->toBe([
        [
            'label' => 'JSON Array',
            'mediaType' => 'application/json',
        ],
        [
            'label' => 'Plain text Array',
            'mediaType' => 'text/plain',
        ],
    ]);
});

test('it merges all of qualifiers and deduplicates equivalent any of choices', function () {
    $formats = app(ProcessOutputFormatExtractor::class)->formats([
        'allOf' => [
            ['contentEncoding' => 'utf-8'],
            [
                'anyOf' => [
                    [
                        'title' => 'GeoJSON',
                        'contentMediaType' => 'application/geo+json',
                        'contentSchema' => ['required' => ['type'], 'type' => 'object'],
                    ],
                    [
                        'title' => 'Duplicate label is ignored',
                        'contentMediaType' => 'application/geo+json',
                        'contentSchema' => ['type' => 'object', 'required' => ['type']],
                    ],
                    [
                        'contentMediaType' => 'text/plain',
                        '$ref' => '#/$defs/plain',
                    ],
                ],
            ],
        ],
    ]);

    expect($formats)->toBe([
        [
            'label' => 'GeoJSON',
            'mediaType' => 'application/geo+json',
            'encoding' => 'utf-8',
            'schema' => ['required' => ['type'], 'type' => 'object'],
        ],
        [
            'label' => 'text/plain',
            'mediaType' => 'text/plain',
            'encoding' => 'utf-8',
            'schema' => '#/$defs/plain',
        ],
    ]);
});

test('it ignores schema variants without a media type', function () {
    $formats = app(ProcessOutputFormatExtractor::class)->formats([
        'oneOf' => [
            ['title' => 'No format', 'type' => 'object'],
            ['title' => 'Text', 'contentMediaType' => 'text/plain'],
        ],
    ]);

    expect($formats)->toBe([
        [
            'label' => 'Text',
            'mediaType' => 'text/plain',
        ],
    ]);
});

test('it removes display-only and unexpected data from request formats', function () {
    $requestFormat = app(ProcessOutputFormatExtractor::class)->requestFormat([
        'label' => 'GeoJSON document',
        'mediaType' => 'application/geo+json',
        'encoding' => 'utf-8',
        'schema' => ['type' => 'object'],
        'unexpected' => 'not trusted',
    ]);

    expect($requestFormat)->toBe([
        'mediaType' => 'application/geo+json',
        'encoding' => 'utf-8',
        'schema' => ['type' => 'object'],
    ]);
});
