import { describe, expect, test } from 'bun:test';

import {
    colorForValue,
    colorStopsFromGeoStylerStyle,
    isLngLatBoundingBox,
    lngLatBoundsFromGeoTiffMetadata,
    scaledRasterSize,
    sldHasShadedRelief,
} from '../../resources/js/lib/geotiff-map-preview';

describe('GeoTIFF map preview helpers', () => {
    test('accepts only longitude latitude bounding boxes', () => {
        expect(isLngLatBoundingBox([14, 40, 15, 41])).toBe(true);
        expect(isLngLatBoundingBox([500000, 4500000, 501000, 4501000])).toBe(
            false,
        );
        expect(isLngLatBoundingBox([15, 40, 14, 41])).toBe(false);
    });

    test('converts WGS84 UTM geotiff bounds to longitude latitude bounds', () => {
        const bounds = lngLatBoundsFromGeoTiffMetadata(
            [
                446742.78754322696, 4513955.432937851, 456868.84361438616,
                4524055.119071325,
            ],
            {
                ProjectedCSTypeGeoKey: 32633,
            },
        );

        expect(bounds?.[0]).toBeCloseTo(14.368, 3);
        expect(bounds?.[1]).toBeCloseTo(40.7749, 3);
        expect(bounds?.[2]).toBeCloseTo(14.4889, 3);
        expect(bounds?.[3]).toBeCloseTo(40.8664, 3);
    });

    test('scales raster dimensions without upscaling', () => {
        expect(scaledRasterSize(4000, 2000, 1024)).toEqual({
            width: 1024,
            height: 512,
        });
        expect(scaledRasterSize(400, 200, 1024)).toEqual({
            width: 400,
            height: 200,
        });
    });

    test('extracts raster color map stops from a GeoStyler style', () => {
        const stops = colorStopsFromGeoStylerStyle({
            rules: [
                {
                    symbolizers: [
                        {
                            kind: 'Raster',
                            colorMap: {
                                colorMapEntries: [
                                    { color: '#000000', quantity: 0 },
                                    { color: '#ffffff', quantity: 100 },
                                ],
                            },
                        },
                    ],
                },
            ],
        });

        expect(stops).toEqual([
            { color: [0, 0, 0, 255], quantity: 0 },
            { color: [255, 255, 255, 255], quantity: 100 },
        ]);
    });

    test('applies color map entry opacity to raster color stops', () => {
        const stops = colorStopsFromGeoStylerStyle({
            rules: [
                {
                    symbolizers: [
                        {
                            kind: 'Raster',
                            colorMap: {
                                colorMapEntries: [
                                    {
                                        color: '#000000',
                                        quantity: 0,
                                        opacity: 0,
                                    },
                                    {
                                        color: '#DC3220',
                                        quantity: 1,
                                        opacity: 0.6,
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        });

        expect(stops).toEqual([
            { color: [0, 0, 0, 0], quantity: 0 },
            { color: [220, 50, 32, 153], quantity: 1 },
        ]);
    });

    test('interpolates colors between stops', () => {
        expect(
            colorForValue(50, [
                { color: [0, 0, 0, 255], quantity: 0 },
                { color: [100, 100, 100, 255], quantity: 100 },
            ]),
        ).toEqual([50, 50, 50, 255]);
    });

    test('detects shaded relief raster styles', () => {
        expect(
            sldHasShadedRelief(`
                <RasterSymbolizer>
                    <ShadedRelief />
                </RasterSymbolizer>
            `),
        ).toBe(true);

        expect(
            sldHasShadedRelief(`
                <RasterSymbolizer>
                    <ColorMap />
                </RasterSymbolizer>
            `),
        ).toBe(false);
    });
});
