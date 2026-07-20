import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import type {
    TranslationKey,
    TranslationValues,
} from '../../resources/js/lib/i18n/translation';
import { translate } from '../../resources/js/lib/i18n/translation';
import { validateOgcInputs } from '../../resources/js/lib/ogc-ajv-validation';
import type { OgcNormalizedField } from '../../resources/js/types/ogc';

const t = (key: TranslationKey, values?: TranslationValues): string =>
    translate('it', key, values);

const schemaRoot = (properties: Record<string, unknown>, required: string[]) =>
    ({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties,
        required,
        additionalProperties: false,
    }) as const;

type ProcessFixture = {
    id: string;
    inputs: Record<
        string,
        {
            minOccurs?: number;
            schema: Record<string, unknown>;
        }
    >;
    examples: Array<{
        payload_example: { inputs: Record<string, unknown> };
    }>;
};

describe('OGC Ajv validation', () => {
    test('exposes an input validator for service schemas', () => {
        expect(validateOgcInputs).toBeFunction();
    });

    test('maps required, enum, exclusive bound and additional property errors to form paths', () => {
        const fields: Record<string, OgcNormalizedField> = {
            geometry: {
                name: 'geometry',
                title: 'Geometry',
                kind: 'object',
                fields: {
                    g: {
                        name: 'g',
                        title: 'Geometry',
                        kind: 'enum',
                        required: true,
                        options: ['conduit', 'fissure'],
                    },
                    length: {
                        name: 'length',
                        title: 'Length',
                        kind: 'scalar',
                        type: 'number',
                        required: true,
                    },
                },
            },
        };
        const schema = schemaRoot(
            {
                geometry: {
                    type: 'object',
                    required: ['g', 'length'],
                    additionalProperties: false,
                    properties: {
                        g: {
                            type: 'string',
                            enum: ['conduit', 'fissure'],
                        },
                        length: {
                            type: 'number',
                            exclusiveMinimum: 0,
                        },
                    },
                },
            },
            ['geometry'],
        );

        const errors = validateOgcInputs({
            schema,
            fields,
            inputs: {
                geometry: {
                    g: 'triangle',
                    length: 0,
                    unexpected: true,
                },
                unknown: true,
            },
            translate: t,
        });
        const missing = validateOgcInputs({
            schema,
            fields,
            inputs: { geometry: { length: 1 } },
            translate: t,
        });

        expect(errors).toEqual({
            'inputs.geometry.value.unexpected':
                'Questa proprietà non è consentita.',
            'inputs.unknown': 'Questo input non è dichiarato dal processo.',
            'inputs.geometry.value.g':
                'Seleziona una delle opzioni disponibili.',
            'inputs.geometry.value.length':
                'Il valore deve essere maggiore di 0.',
        });
        expect(missing['inputs.geometry.value.g']).toBe(
            'Compila questo campo.',
        );
    });

    test('does not coerce numeric strings or fractional integers', () => {
        const fields: Record<string, OgcNormalizedField> = {
            count: {
                name: 'count',
                title: 'Count',
                kind: 'scalar',
                type: 'integer',
            },
            ratio: {
                name: 'ratio',
                title: 'Ratio',
                kind: 'scalar',
                type: 'number',
            },
        };
        const schema = schemaRoot(
            {
                count: { type: 'integer' },
                ratio: { type: 'number' },
            },
            ['count', 'ratio'],
        );

        expect(
            validateOgcInputs({
                schema,
                fields,
                inputs: { count: 1.5, ratio: '0.5' },
                translate: t,
            }),
        ).toEqual({
            'inputs.count': 'Inserisci un numero intero.',
            'inputs.ratio': 'Inserisci un numero valido.',
        });
    });

    test('omits optional properties when blank values are explicitly submitted', () => {
        const fields: Record<string, OgcNormalizedField> = {
            optionalNumber: {
                name: 'optionalNumber',
                title: 'Optional number',
                kind: 'scalar',
                type: 'number',
            },
            optionalPattern: {
                name: 'optionalPattern',
                title: 'Optional pattern',
                kind: 'scalar',
                type: 'string',
            },
        };
        const schema = schemaRoot(
            {
                optionalNumber: { type: 'number' },
                optionalPattern: { type: 'string', pattern: '^value$' },
            },
            [],
        );

        expect(
            validateOgcInputs({
                schema,
                fields,
                inputs: { optionalNumber: null, optionalPattern: '' },
                translate: t,
            }),
        ).toEqual({});
    });

    test('enforces solwcad row length and its advertised numeric string pattern', () => {
        const fields: Record<string, OgcNormalizedField> = {
            'sw.data': {
                name: 'sw.data',
                title: 'User data',
                kind: 'array_table',
            },
        };
        const schema = schemaRoot(
            {
                'sw.data': {
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'array',
                        minItems: 14,
                        maxItems: 14,
                        items: {
                            type: 'string',
                            pattern:
                                '^[+-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+-]?[0-9]+)?$',
                        },
                    },
                },
            },
            ['sw.data'],
        );

        const errors = validateOgcInputs({
            schema,
            fields,
            inputs: {
                'sw.data': [
                    ['invalid', ...Array.from({ length: 14 }, () => '1.')],
                ],
            },
            translate: t,
        });

        expect(errors['inputs.sw.data.0']).toBe(
            'Inserisci al massimo 14 elementi.',
        );
        expect(errors['inputs.sw.data.0.0']).toBe(
            'Usa il formato richiesto, ad esempio 1273., .0400 o 1.00D8.',
        );
    });

    test('shows the schema expression when no friendlier pattern hint is available', () => {
        const fields: Record<string, OgcNormalizedField> = {
            code: {
                name: 'code',
                title: 'Code',
                kind: 'scalar',
                type: 'string',
                minOccurs: 1,
            },
        };

        expect(
            validateOgcInputs({
                schema: schemaRoot(
                    { code: { type: 'string', pattern: '^value$' } },
                    ['code'],
                ),
                fields,
                inputs: { code: 'other' },
                translate: t,
            }),
        ).toEqual({
            'inputs.code': 'Usa il formato richiesto: ^value$',
        });
    });

    test('validates only the oneOf variant selected by the form', () => {
        const fields: Record<string, OgcNormalizedField> = {
            choice: {
                name: 'choice',
                title: 'Choice',
                kind: 'oneOf',
                variants: [
                    {
                        id: '0',
                        label: 'First',
                        required: ['mode', 'first'],
                        fields: {},
                    },
                    {
                        id: '1',
                        label: 'Second',
                        required: ['mode', 'second'],
                        fields: {},
                    },
                ],
            },
        };
        const schema = schemaRoot(
            {
                choice: {
                    type: 'object',
                    oneOf: [
                        {
                            required: ['mode', 'first'],
                            additionalProperties: false,
                            properties: {
                                mode: { type: 'integer', enum: [0] },
                                first: { type: 'string' },
                            },
                        },
                        {
                            required: ['mode', 'second'],
                            additionalProperties: false,
                            properties: {
                                mode: { type: 'integer', enum: [1] },
                                second: { type: 'string' },
                            },
                        },
                    ],
                },
            },
            ['choice'],
        );

        const errors = validateOgcInputs({
            schema,
            fields,
            inputs: {
                choice: {
                    variant: '1',
                    value: { mode: 1 },
                },
            },
            translate: t,
        });

        expect(errors).toEqual({
            'inputs.choice.value.second': 'Compila questo campo.',
        });
    });

    test('applies the pybox item property sum keyword', () => {
        const fields: Record<string, OgcNormalizedField> = {
            multiple_values: {
                name: 'multiple_values',
                title: 'Particle classes',
                kind: 'array_object',
            },
        };
        const schema = schemaRoot(
            {
                multiple_values: {
                    type: 'array',
                    itemPropertySum: {
                        property: 'eps0',
                        exclusiveMaximum: 1,
                    },
                    items: {
                        type: 'object',
                        required: ['eps0'],
                        properties: { eps0: { type: 'number' } },
                    },
                },
            },
            ['multiple_values'],
        );

        const errors = validateOgcInputs({
            schema,
            fields,
            inputs: {
                multiple_values: Array.from({ length: 10 }, () => ({
                    eps0: 0.1,
                })),
            },
            translate: t,
        });
        const valid = validateOgcInputs({
            schema,
            fields,
            inputs: {
                multiple_values: Array.from({ length: 9 }, () => ({
                    eps0: 0.1,
                })),
            },
            translate: t,
        });

        expect(errors).toEqual({
            'inputs.multiple_values':
                'La somma di eps0 deve essere inferiore a 1.',
        });
        expect(valid).toEqual({});
    });

    test.each(['conduit', 'pybox', 'solwcad'])(
        'compiles the refreshed %s service schema and accepts its example',
        (processId) => {
            const process = processFixture(processId);
            const { schema, fields, inputs } = validationDataFor(process);

            expect(
                validateOgcInputs({
                    schema,
                    fields,
                    inputs,
                    translate: t,
                }),
            ).toEqual({});
        },
    );
});

function processFixture(processId: string): ProcessFixture {
    return JSON.parse(
        readFileSync(`tests/Fixtures/Ogc/process-${processId}.json`, 'utf8'),
    ) as ProcessFixture;
}

function validationDataFor(process: ProcessFixture): {
    schema: Record<string, unknown>;
    fields: Record<string, OgcNormalizedField>;
    inputs: Record<string, unknown>;
} {
    const fields = Object.fromEntries(
        Object.entries(process.inputs).map(([name, input]) => [
            name,
            normalizedFieldForFixture(name, input.schema),
        ]),
    );
    const properties = Object.fromEntries(
        Object.entries(process.inputs).map(([name, input]) => [
            name,
            process.id === 'pybox' && name === 'multiple_values'
                ? {
                      ...input.schema,
                      itemPropertySum: {
                          property: 'eps0',
                          exclusiveMaximum: 1,
                      },
                  }
                : input.schema,
        ]),
    );
    const required = Object.entries(process.inputs)
        .filter(([, input]) => Number(input.minOccurs) > 0)
        .map(([name]) => name);
    const exampleInputs = process.examples[0].payload_example.inputs;
    const inputs = Object.fromEntries(
        Object.entries(exampleInputs).map(([name, rawInput]) => {
            const field = fields[name];
            const value = unwrapFixtureInput(rawInput);

            if (field?.kind !== 'oneOf') {
                return [name, value];
            }

            return [
                name,
                {
                    variant: selectedFixtureVariant(
                        process.inputs[name].schema,
                        value,
                    ),
                    value,
                },
            ];
        }),
    );

    return {
        schema: schemaRoot(properties, required),
        fields,
        inputs,
    };
}

function normalizedFieldForFixture(
    name: string,
    schema: Record<string, unknown>,
): OgcNormalizedField {
    const oneOf = Array.isArray(schema.oneOf) ? schema.oneOf : [];
    const itemSchema = isRecord(schema.items) ? schema.items : {};
    const kind: OgcNormalizedField['kind'] =
        oneOf.length > 0
            ? 'oneOf'
            : schema.type === 'object'
              ? 'object'
              : schema.type === 'array' && itemSchema.type === 'object'
                ? 'array_object'
                : schema.type === 'array' && itemSchema.type === 'array'
                  ? 'array_table'
                  : Array.isArray(schema.enum)
                    ? 'enum'
                    : 'scalar';

    return {
        name,
        title: name,
        kind,
        variants:
            kind === 'oneOf'
                ? oneOf.map((variant, index) => ({
                      id: String(index),
                      label: String(index),
                      required:
                          isRecord(variant) && Array.isArray(variant.required)
                              ? variant.required.map(String)
                              : [],
                      fields: {},
                  }))
                : undefined,
    };
}

function selectedFixtureVariant(
    schema: Record<string, unknown>,
    value: unknown,
): string {
    if (!isRecord(value) || !Array.isArray(schema.oneOf)) {
        return '0';
    }

    const index = schema.oneOf.findIndex((variant) => {
        if (!isRecord(variant)) {
            return false;
        }

        const required = Array.isArray(variant.required)
            ? variant.required.map(String)
            : [];
        const properties = isRecord(variant.properties)
            ? variant.properties
            : {};

        return (
            required.every((property) => property in value) &&
            Object.entries(properties).every(([property, propertySchema]) => {
                if (!isRecord(propertySchema) || !(property in value)) {
                    return true;
                }

                return !Array.isArray(propertySchema.enum)
                    ? true
                    : propertySchema.enum.includes(value[property]);
            })
        );
    });

    return String(Math.max(index, 0));
}

function unwrapFixtureInput(value: unknown): unknown {
    return isRecord(value) && 'value' in value ? value.value : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
