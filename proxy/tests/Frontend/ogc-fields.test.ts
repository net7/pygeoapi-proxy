import { describe, expect, test } from 'bun:test';

import {
    columnDisplayLabel,
    fieldDisplayLabel,
    optionDisplayLabel,
    referenceDisplayLabel,
    variantDisplayLabel,
} from '../../resources/js/lib/ogc-fields';
import type { OgcNormalizedField } from '../../resources/js/types';

describe('OGC field display helpers', () => {
    test('localizes persisted fallback labels and preserves descriptive labels', () => {
        const column = { key: '0', label: 'Column 1' };
        expect(columnDisplayLabel(column, 'it')).toBe('Colonna 1');
        expect(columnDisplayLabel(column, 'en')).toBe('Column 1');
        expect(
            columnDisplayLabel({ ...column, label: 'Temperature' }, 'it'),
        ).toBe('Temperature');
        expect(variantDisplayLabel('Variant', 'it')).toBe('Variante');
        expect(variantDisplayLabel('Variant', 'en')).toBe('Variant');
        expect(variantDisplayLabel('Temperature', 'it')).toBe('Temperature');
    });

    test('shows the descriptive title without the support reference', () => {
        expect(
            fieldDisplayLabel({
                name: 'sw.data',
                title: 'User data',
            } as OgcNormalizedField),
        ).toBe('User data');
    });

    test('shows only the key when the title falls back to the field name', () => {
        expect(
            fieldDisplayLabel({
                name: 'sw.data',
                title: 'sw.data',
            } as OgcNormalizedField),
        ).toBe('sw.data');
    });

    test.each(['', '   ', undefined])(
        'keeps a usable label when the descriptive title is missing',
        (title) => {
            expect(
                fieldDisplayLabel({
                    name: 'sw.data',
                    title,
                } as OgcNormalizedField),
            ).toBe('sw.data');
        },
    );

    test('shows enum options once', () => {
        expect(optionDisplayLabel('conduit')).toBe('conduit');
        expect(optionDisplayLabel(1)).toBe('1');
        expect(optionDisplayLabel(true)).toBe('true');
    });

    test('shows reference options as label href pairs', () => {
        expect(
            referenceDisplayLabel({
                label: 'Example CSV',
                href: 'https://example.test/input.csv',
            }),
        ).toBe('Example CSV: https://example.test/input.csv');
    });
});
