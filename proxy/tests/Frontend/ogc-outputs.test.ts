import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { hasPendingMapLayers } from '../../resources/js/lib/ogc-map-layers';
import {
    automaticOutputTransmissionMode,
    downloadLabelForMediaType,
    isPreviewableImageMediaType,
} from '../../resources/js/lib/ogc-outputs';
import { groupProcessResults } from '../../resources/js/lib/ogc-result-groups';
import type { ProcessExecutionResult } from '../../resources/js/types';
import type { OgcNormalizedOutput } from '../../resources/js/types';

const downloadLabels = {
    file: 'File',
    image: 'Image',
};

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

describe('downloadLabelForMediaType', () => {
    test('uses compact file format labels for download buttons', () => {
        expect(
            downloadLabelForMediaType('application/json', downloadLabels),
        ).toBe('JSON');
        expect(
            downloadLabelForMediaType(
                'application/vnd.example+json',
                downloadLabels,
            ),
        ).toBe('JSON');
        expect(downloadLabelForMediaType('text/csv', downloadLabels)).toBe(
            'CSV',
        );
        expect(
            downloadLabelForMediaType(
                'image/tiff; application=geotiff',
                downloadLabels,
            ),
        ).toBe('GeoTIFF');
        expect(
            downloadLabelForMediaType(
                'application/vnd.ogc.sld+xml',
                downloadLabels,
            ),
        ).toBe('SLD');
        expect(downloadLabelForMediaType(null, downloadLabels)).toBe('File');
    });

    test('labels browser-safe raster downloads as images', () => {
        expect(downloadLabelForMediaType('image/png', downloadLabels)).toBe(
            'Image',
        );
        expect(downloadLabelForMediaType('image/jpeg', downloadLabels)).toBe(
            'Image',
        );
        expect(downloadLabelForMediaType('image/webp', downloadLabels)).toBe(
            'Image',
        );
        expect(
            downloadLabelForMediaType(
                'image/gif; charset=binary',
                downloadLabels,
            ),
        ).toBe('Image');
    });
});

describe('isPreviewableImageMediaType', () => {
    test('accepts browser-safe raster formats', () => {
        expect(isPreviewableImageMediaType('image/png')).toBe(true);
        expect(isPreviewableImageMediaType('image/jpeg')).toBe(true);
        expect(isPreviewableImageMediaType('image/webp')).toBe(true);
        expect(isPreviewableImageMediaType('image/gif; charset=binary')).toBe(
            true,
        );
    });

    test('rejects unsafe or unsupported image formats', () => {
        expect(isPreviewableImageMediaType('image/svg+xml')).toBe(false);
        expect(isPreviewableImageMediaType('image/tiff')).toBe(false);
        expect(isPreviewableImageMediaType('application/octet-stream')).toBe(
            false,
        );
        expect(isPreviewableImageMediaType(null)).toBe(false);
    });
});

describe('hasPendingMapLayers', () => {
    test('detects map layers that still need page refreshes', () => {
        expect(
            hasPendingMapLayers([
                result({
                    mapLayer: {
                        type: 'wms',
                        status: 'pending',
                        name: null,
                        styleName: null,
                        bounds: null,
                        publishedAt: null,
                        error: null,
                        warning: null,
                    },
                }),
            ]),
        ).toBe(true);

        expect(
            hasPendingMapLayers([
                result({
                    mapLayer: {
                        type: 'wms',
                        status: 'publishing',
                        name: 'layer',
                        styleName: 'style',
                        bounds: null,
                        publishedAt: null,
                        error: null,
                        warning: null,
                    },
                }),
            ]),
        ).toBe(true);
    });

    test('stops refreshing after map layers reach a final state', () => {
        expect(
            hasPendingMapLayers([
                result({
                    mapLayer: {
                        type: 'wms',
                        status: 'published',
                        name: 'layer',
                        styleName: 'style',
                        bounds: [14.1, 40.6, 14.7, 41.1],
                        publishedAt: '2026-07-08T10:00:00+00:00',
                        error: null,
                        warning: null,
                    },
                }),
                result({
                    mapLayer: {
                        type: 'wms',
                        status: 'failed',
                        name: 'layer',
                        styleName: 'style',
                        bounds: null,
                        publishedAt: null,
                        error: 'Publication failed.',
                        warning: null,
                    },
                }),
            ]),
        ).toBe(false);
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

    test('prefers logical output title and description for map groups', () => {
        const groups = groupProcessResults(
            [
                result({
                    id: 10,
                    outputId: 'dem.geotiff',
                    title: 'Primary DEM - GeoTIFF',
                    description: 'GeoTIFF component description',
                    mediaType: 'image/tiff; application=geotiff',
                }),
                result({
                    id: 11,
                    outputId: 'dem.sld',
                    title: 'Primary DEM - SLD',
                    description: 'SLD component description',
                    mediaType: 'application/vnd.ogc.sld+xml',
                }),
            ],
            {
                dem: {
                    title: 'Primary DEM',
                    description:
                        'The local DSM (GeoTIFF) used for the simulation.',
                },
            },
        );

        expect(groups[0]).toMatchObject({
            kind: 'geotiff-map',
            outputId: 'dem',
            title: 'Primary DEM',
            description: 'The local DSM (GeoTIFF) used for the simulation.',
        });
    });

    test('keeps component metadata as a fallback for historical executions', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                title: 'Primary DEM - GeoTIFF',
                description: 'GeoTIFF component description',
                mediaType: 'image/tiff',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ]);

        expect(groups[0]).toMatchObject({
            kind: 'geotiff-map',
            title: 'Primary DEM',
            description: 'GeoTIFF component description',
        });
    });

    test('renders every non empty result description even when it matches title', () => {
        const source = readFileSync(
            'resources/js/components/ogc/result-preview.tsx',
            'utf8',
        );

        expect(source).toMatch(
            /<CardDescription>\s*\{result\.description\}\s*<\/CardDescription>/,
        );
        expect(source).not.toContain('result.description !== result.title');
    });

    test('keeps title and description spacing consistent across result cards', () => {
        const resultPreviewSource = readFileSync(
            'resources/js/components/ogc/result-preview.tsx',
            'utf8',
        );
        const jobDetailSource = readFileSync(
            'resources/js/pages/process-executions/show.tsx',
            'utf8',
        );

        expect(resultPreviewSource).toContain(
            '<div className="flex min-w-0 flex-col gap-1">',
        );
        expect(resultPreviewSource).toContain(
            '<div className="flex items-start justify-between gap-3">',
        );
        expect(jobDetailSource).toContain(
            '<div className="flex min-w-0 flex-col gap-1">',
        );
    });
});
