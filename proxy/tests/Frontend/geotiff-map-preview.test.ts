import { describe, expect, test } from 'bun:test';

import {
    colorForValue,
    colorStopsFromGeoStylerStyle,
    isLngLatBoundingBox,
    scaledRasterSize,
} from '../../resources/js/lib/geotiff-map-preview';

describe('GeoTIFF map preview helpers', () => {
    test('accepts only longitude latitude bounding boxes', () => {
        expect(isLngLatBoundingBox([14, 40, 15, 41])).toBe(true);
        expect(isLngLatBoundingBox([500000, 4500000, 501000, 4501000])).toBe(
            false,
        );
        expect(isLngLatBoundingBox([15, 40, 14, 41])).toBe(false);
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

    test('interpolates colors between stops', () => {
        expect(
            colorForValue(50, [
                { color: [0, 0, 0, 255], quantity: 0 },
                { color: [100, 100, 100, 255], quantity: 100 },
            ]),
        ).toEqual([50, 50, 50, 255]);
    });
});
