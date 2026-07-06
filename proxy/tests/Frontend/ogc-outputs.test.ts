import { describe, expect, test } from 'bun:test';

import { automaticOutputTransmissionMode } from '../../resources/js/lib/ogc-outputs';
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
