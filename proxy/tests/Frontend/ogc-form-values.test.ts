import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
    defaultObjectValue,
    exampleInputsToFormValues,
    initialInputValues,
    normalizeInputs,
    pruneOptionalInputValues,
} from '../../resources/js/lib/ogc-form-values';
import type { OgcNormalizedField } from '../../resources/js/types';
import * as formValues from '../../resources/js/lib/ogc-form-values';

test('reviewing submitted inputs never adds defaults or selects an ambiguous variant', () => {
    const fields: Record<string, OgcNormalizedField> = {
        missing: {
            name: 'missing',
            title: 'Missing',
            kind: 'enum',
            options: [99],
        },
        mode: {
            name: 'mode',
            title: 'Mode',
            kind: 'oneOf',
            variants: [
                {
                    id: '0',
                    label: 'First',
                    required: [],
                    fields: {
                        x: {
                            name: 'x',
                            title: 'X',
                            kind: 'enum',
                            options: [1],
                        },
                    },
                },
                {
                    id: '1',
                    label: 'Second',
                    required: [],
                    fields: {
                        x: {
                            name: 'x',
                            title: 'X',
                            kind: 'enum',
                            options: [1],
                        },
                    },
                },
            ],
        },
    };

    expect(
        formValues.reviewInputValues(fields, {
            mode: { variant: '1', value: {} },
        }),
    ).toEqual({ mode: { variant: '1', value: {} } });
    expect(
        formValues.reviewInputValues(fields, { mode: { value: { x: 1 } } }),
    ).toEqual({ mode: { variant: '', value: { x: 1 } } });
});

test('uploaded filenames are kept separate from the processing payload including dotted input names', () => {
    const fields: Record<string, OgcNormalizedField> = {
        'input.data': {
            name: 'input.data',
            title: 'Data',
            kind: 'scalar',
            mediaType: 'text/csv',
        },
    };

    expect(
        formValues.prepareInputSubmission(fields, {
            'input.data': {
                value: 'a,b',
                mediaType: 'text/csv',
                __inputFileName: 'measurements.csv',
                __inputFileContent: 'YSxiCg==',
                __inputFileEncoding: 'base64',
            },
        }),
    ).toEqual({
        inputs: { 'input.data': { value: 'a,b', mediaType: 'text/csv' } },
        inputFiles: [
            {
                path: ['input.data'],
                name: 'measurements.csv',
                content: 'YSxiCg==',
                encoding: 'base64',
            },
        ],
    });
});

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

    test('builds initial values from stored job inputs without losing defaults', () => {
        expect(
            initialInputValues(
                { 'swinput.data': singletonVariant },
                {
                    'swinput.data': {
                        value: { ndat1: 3 },
                    },
                },
            ),
        ).toEqual({
            'swinput.data': {
                variant: '1',
                value: { ndat1: 3, kl: 1 },
            },
        });
    });

    test.each([
        [
            {
                value: {
                    ndat1: 10,
                    kl: 1,
                    iopen: 0,
                    fopen: '1.00D8',
                },
            },
            '1',
        ],
        [
            {
                value: {
                    ndat1: 10,
                    kl: 2,
                    iopen: 1,
                    dt: 0.1,
                    tlimit: 100,
                },
            },
            '2',
        ],
        [{ value: { ndat1: 10, ndat2: 20, kl: -1 } }, '3'],
    ])(
        'restores SOLWCAD stored inputs into variant %s',
        (storedInput, expectedVariant) => {
            const values = initialInputValues(
                { 'swinput.data': solwcadDesiredComputationField() },
                { 'swinput.data': storedInput },
            );

            expect(values['swinput.data']).toMatchObject({
                variant: expectedVariant,
                value: storedInput.value,
            });
        },
    );

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

    test('omits cleared optional values while preserving required blanks, zero and false', () => {
        expect(
            pruneOptionalInputValues(
                {
                    optionalText: {
                        name: 'optionalText',
                        title: 'Optional text',
                        kind: 'scalar',
                        type: 'string',
                    },
                    requiredText: {
                        name: 'requiredText',
                        title: 'Required text',
                        kind: 'scalar',
                        type: 'string',
                        minOccurs: 1,
                    },
                    zero: {
                        name: 'zero',
                        title: 'Zero',
                        kind: 'scalar',
                        type: 'number',
                    },
                    disabled: {
                        name: 'disabled',
                        title: 'Disabled',
                        kind: 'scalar',
                        type: 'boolean',
                    },
                    choice: singletonVariant,
                },
                {
                    optionalText: '',
                    requiredText: '',
                    zero: 0,
                    disabled: false,
                    choice: {
                        variant: '1',
                        value: { ndat1: 1, kl: 1, iopen: 0 },
                    },
                },
            ),
        ).toEqual({
            requiredText: '',
            zero: 0,
            disabled: false,
            choice: {
                variant: '1',
                value: { ndat1: 1, kl: 1, iopen: 0 },
            },
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
        expect(source).toContain('<FieldGroup key={selected.id}');
    });

    test('keeps conditional fields in normal layout flow before select interaction', () => {
        const source = readFileSync(
            'resources/js/components/ogc/section-field-set.tsx',
            'utf8',
        );

        expect(source).toContain(
            "'block max-w-full min-w-0 gap-4 rounded-md border",
        );
        expect(source).toContain(
            '<div className="flex min-w-0 flex-col gap-4">',
        );
    });
});

type ProcessFixture = {
    inputs: Record<string, { schema: Record<string, unknown> }>;
};

function solwcadDesiredComputationField(): OgcNormalizedField {
    const process = JSON.parse(
        readFileSync('tests/Fixtures/Ogc/process-solwcad.json', 'utf8'),
    ) as ProcessFixture;
    const schema = process.inputs['swinput.data'].schema;
    const variants = Array.isArray(schema.oneOf) ? schema.oneOf : [];

    return {
        name: 'swinput.data',
        title: 'Desired computation',
        kind: 'oneOf',
        variants: variants.map((variant, index) => {
            const variantSchema = isRecord(variant) ? variant : {};
            const required = Array.isArray(variantSchema.required)
                ? variantSchema.required.map(String)
                : [];
            const properties = isRecord(variantSchema.properties)
                ? variantSchema.properties
                : {};

            return {
                id: String(index),
                label: String(variantSchema.title ?? index),
                required,
                additionalProperties:
                    typeof variantSchema.additionalProperties === 'boolean'
                        ? variantSchema.additionalProperties
                        : null,
                fields: Object.fromEntries(
                    Object.entries(properties).map(([name, propertySchema]) => {
                        const property = isRecord(propertySchema)
                            ? propertySchema
                            : {};
                        const options = Array.isArray(property.enum)
                            ? (property.enum as Array<
                                  string | number | boolean
                              >)
                            : undefined;

                        return [
                            name,
                            {
                                name,
                                title: String(property.title ?? name),
                                kind: options ? 'enum' : 'scalar',
                                type: String(property.type ?? 'string'),
                                options,
                                required: required.includes(name),
                            } satisfies OgcNormalizedField,
                        ];
                    }),
                ),
            };
        }),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
