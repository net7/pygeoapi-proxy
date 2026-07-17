import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
    defaultObjectValue,
    exampleInputsToFormValues,
    initialInputValues,
    normalizeInputs,
} from '../../resources/js/lib/ogc-form-values';
import type { OgcNormalizedField } from '../../resources/js/types';

const singletonVariant: OgcNormalizedField = {
    name: 'swinput.data',
    title: 'Desired computation',
    kind: 'oneOf',
    variants: [
        {
            id: '1',
            label: 'Pressure sweep',
            description: 'Compute from pressure to atmosphere.',
            required: ['ndat1', 'kl', 'iopen'],
            fields: {
                ndat1: {
                    name: 'ndat1',
                    title: 'ndat1',
                    kind: 'scalar',
                    type: 'integer',
                    required: true,
                },
                kl: {
                    name: 'kl',
                    title: 'kl',
                    kind: 'enum',
                    options: [1],
                    required: true,
                },
                iopen: {
                    name: 'iopen',
                    title: 'iopen',
                    kind: 'enum',
                    options: [0, 1],
                    required: true,
                },
            },
        },
    ],
};

describe('OGC form values', () => {
    test('initializes the only enum value inside the selected variant', () => {
        expect(
            initialInputValues({
                'swinput.data': singletonVariant,
            }),
        ).toEqual({
            'swinput.data': {
                variant: '1',
                value: {
                    kl: 1,
                },
            },
        });
    });

    test('merges singleton defaults into example values', () => {
        expect(
            exampleInputsToFormValues(
                {
                    'swinput.data': singletonVariant,
                },
                {
                    'swinput.data': {
                        value: {
                            ndat1: 1,
                        },
                    },
                },
            ),
        ).toEqual({
            'swinput.data': {
                variant: '1',
                value: {
                    ndat1: 1,
                    kl: 1,
                },
            },
        });
    });

    test('keeps variant metadata until backend validation', () => {
        expect(
            normalizeInputs(
                {
                    'swinput.data': singletonVariant,
                },
                {
                    'swinput.data': {
                        variant: '1',
                        value: {
                            ndat1: 1,
                            kl: 1,
                            iopen: 0,
                        },
                    },
                },
            ),
        ).toEqual({
            'swinput.data': {
                variant: '1',
                value: {
                    ndat1: 1,
                    kl: 1,
                    iopen: 0,
                },
            },
        });
    });

    test('builds singleton defaults directly for variant changes', () => {
        const variant = singletonVariant.variants?.[0];

        expect(defaultObjectValue(variant?.fields ?? {})).toEqual({
            kl: 1,
        });
    });

    test('renders the selector before its description without an id prefix', () => {
        const source = readFileSync(
            'resources/js/components/ogc/one-of-field.tsx',
            'utf8',
        );

        expect(source.indexOf('<Select')).toBeLessThan(
            source.indexOf('selected.description'),
        );
        expect(source).toContain('{variant.label}');
        expect(source).not.toContain('{variant.id}: {variant.label}');
    });
});
