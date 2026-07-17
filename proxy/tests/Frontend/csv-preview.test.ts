import { describe, expect, test } from 'bun:test';

import { normalizeCsvPreview } from '../../resources/js/lib/csv-preview';

describe('normalizeCsvPreview', () => {
    test('normalizes structured preview payloads', () => {
        const preview = normalizeCsvPreview({
            headers: ['a', 'b'],
            rows: [['1', '2']],
            truncated: true,
            source: 'a,b\n1,2\n',
        });

        expect(preview).toEqual({
            headers: ['a', 'b'],
            rows: [['1', '2']],
            truncated: true,
            columnCount: 2,
        });
    });

    test('pads irregular structured rows to a stable column count', () => {
        const preview = normalizeCsvPreview({
            headers: ['a'],
            rows: [['1', '2'], ['3']],
            truncated: false,
        });

        expect(preview).toEqual({
            headers: ['a', ''],
            rows: [
                ['1', '2'],
                ['3', ''],
            ],
            truncated: false,
            columnCount: 2,
        });
    });

    test('parses legacy string previews with quoted commas', () => {
        const preview = normalizeCsvPreview(
            'name,description\nEtna,"gas, ash"\n"Quote ""inside""",blank\n',
        );

        expect(preview).toEqual({
            headers: ['name', 'description'],
            rows: [
                ['Etna', 'gas, ash'],
                ['Quote "inside"', 'blank'],
            ],
            truncated: false,
            columnCount: 2,
        });
    });

    test('returns null for empty preview data', () => {
        expect(normalizeCsvPreview({ headers: [], rows: [] })).toBeNull();
        expect(normalizeCsvPreview('')).toBeNull();
        expect(normalizeCsvPreview(null)).toBeNull();
    });
});
