import { describe, expect, test } from 'bun:test';

import { automaticOutputTransmissionMode } from '../../resources/js/lib/ogc-outputs';
import { groupProcessResults } from '../../resources/js/lib/ogc-result-groups';
import type { ProcessExecutionResult } from '../../resources/js/types';
import type { OgcNormalizedOutput } from '../../resources/js/types';

describe('automaticOutputTransmissionMode', () => {
    test('requests plain text and json outputs by value', () => {
        expect(
            automaticOutputTransmissionMode({
                mediaType: 'text/plain',
            } as OgcNormalizedOutput),
        ).toBe('value');

        expect(
            automaticOutputTransmissionMode({
                mediaType: 'application/vnd.example+json',
            } as OgcNormalizedOutput),
        ).toBe('value');
    });

    test('requests file outputs by reference', () => {
        expect(
            automaticOutputTransmissionMode({
                mediaType: 'text/csv',
            } as OgcNormalizedOutput),
        ).toBe('reference');

        expect(
            automaticOutputTransmissionMode({
                mediaType: 'image/tiff; application=geotiff',
                schemaType: 'object',
            } as OgcNormalizedOutput),
        ).toBe('reference');
    });
});

const result = (
    overrides: Partial<ProcessExecutionResult>,
): ProcessExecutionResult => ({
    id: overrides.id ?? 1,
    outputId: overrides.outputId ?? 'gas',
    title: overrides.title ?? null,
    description: overrides.description ?? null,
    mediaType: overrides.mediaType ?? 'application/json',
    cacheStatus: overrides.cacheStatus ?? 'cached',
    preview: overrides.preview ?? null,
    mapLayer: overrides.mapLayer ?? {
        type: null,
        status: null,
        name: null,
        styleName: null,
        bounds: null,
        publishedAt: null,
        error: null,
    },
});

describe('groupProcessResults', () => {
    test('groups geotiff and sld components into one visual map output', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                title: 'Primary DEM - Reference to the GeoTIFF.',
                mediaType: 'image/tiff; application=geotiff',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                title: 'Primary DEM - Reference to the Styled Layer Descriptor.',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            kind: 'geotiff-map',
            outputId: 'dem',
            title: 'Primary DEM',
            geotiff: { id: 10 },
            sld: { id: 11 },
        });
    });

    test('groups plain image tiff geotiff components by output id', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                title: 'Primary DEM - Reference to the GeoTIFF.',
                mediaType: 'image/tiff',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                title: 'Primary DEM - Reference to the Styled Layer Descriptor.',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            kind: 'geotiff-map',
            outputId: 'dem',
            title: 'Primary DEM',
        });
    });

    test('keeps unpaired map components as single results', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                mediaType: 'image/tiff; application=geotiff',
            }),
            result({
                id: 12,
                outputId: 'gas',
                mediaType: 'application/json',
            }),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].kind).toBe('result');
        expect(groups[1].kind).toBe('result');
    });

    test('does not group incompatible media types', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                mediaType: 'text/plain',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups.every((group) => group.kind === 'result')).toBe(true);
    });

    test('preserves order and emits each map group once', () => {
        const groups = groupProcessResults([
            result({ id: 1, outputId: 'input_data', mediaType: 'text/plain' }),
            result({
                id: 2,
                outputId: 'invasion_map.sld',
                title: 'Invasion Map - Styled Layer Descriptor',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
            result({
                id: 3,
                outputId: 'invasion_map.geotiff',
                title: 'Invasion Map - Reference to the GeoTIFF.',
                mediaType: 'application/tiff; application=geotiff',
            }),
        ]);

        expect(groups.map((group) => group.kind)).toEqual([
            'result',
            'geotiff-map',
        ]);
        expect(groups[1]).toMatchObject({
            kind: 'geotiff-map',
            outputId: 'invasion_map',
            title: 'Invasion Map',
        });
    });
});
