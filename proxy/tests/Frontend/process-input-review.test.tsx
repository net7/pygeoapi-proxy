import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import SchemaFieldRenderer from '../../resources/js/components/ogc/schema-field-renderer';
import type { OgcFieldValidationController } from '../../resources/js/lib/ogc-form-validation';
import type { OgcNormalizedField } from '../../resources/js/types';

const validation: OgcFieldValidationController = {
    errors: {},
    validLabel: '',
    stateFor: () => 'neutral',
    fieldChanged: () => undefined,
    resetPathPrefix: () => undefined,
    valuesReplaced: () => undefined,
};

function renderReadOnly(field: OgcNormalizedField, value: unknown): string {
    return renderToStaticMarkup(
        <SchemaFieldRenderer
            field={field}
            value={value}
            path="inputs.example"
            validation={validation}
            onChange={() => {
                throw new Error('Read-only fields cannot change');
            }}
            readOnly
        />,
    );
}

describe('submitted inputs in read-only mode', () => {
    test('does not guess an unknown legacy variant or hide its values', () => {
        const html = renderReadOnly(
            {
                name: 'mode',
                title: 'Mode',
                kind: 'oneOf',
                variants: [
                    { id: '0', label: 'First mode', required: [], fields: {} },
                ],
            },
            { variant: '', value: { historical_value: 7 } },
        );

        expect(html).not.toContain('First mode');
        expect(html).toContain('value="7"');
    });

    test('keeps additional object properties and nested arrays readable', () => {
        const html = renderReadOnly(
            {
                name: 'object',
                title: 'Object',
                kind: 'object',
                fields: {},
            },
            { extra: [{ pressure: 7 }] },
        );

        expect(html).toContain('pressure');
        expect(html).toContain('value="7"');
        expect(html).not.toContain('[object Object]');
    });

    test.each([
        [
            { name: 'n', title: 'Pressure', kind: 'scalar', type: 'number' },
            0,
            'value="0"',
        ],
        [
            {
                name: 'b',
                title: 'Enabled',
                kind: 'enum',
                options: [true, false],
            },
            false,
            'value="false"',
        ],
        [
            { name: 's', title: 'Comment', kind: 'scalar' },
            '<script>alert(1)</script>',
            '&lt;script&gt;',
        ],
    ] as [OgcNormalizedField, unknown, string][])(
        'keeps scalar and selected values readable without editable controls',
        (field, value, expected) => {
            const html = renderReadOnly(field, value);
            expect(html).toContain(expected);
            expect(html).toContain('readOnly=""');
            expect(html).not.toContain('<button');
            expect(html).not.toContain('<script>');
        },
    );

    test('shows the chosen variant and nested values without a variant selector', () => {
        const html = renderReadOnly(
            {
                name: 'mode',
                title: 'Search mode',
                kind: 'oneOf',
                variants: [
                    { id: '0', label: 'First mode', required: [], fields: {} },
                    {
                        id: '1',
                        label: 'Second mode',
                        required: [],
                        fields: {
                            pressure: {
                                name: 'pressure',
                                title: 'Pressure',
                                kind: 'scalar',
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            { variant: '1', value: { pressure: 12 } },
        );

        expect(html).toContain('Second mode');
        expect(html).toContain('value="12"');
        expect(html).not.toContain('<button');
        expect(
            html
                .match(/<input\b[^>]*>/g)
                ?.every((input) => input.includes('readOnly=""')),
        ).toBe(true);
    });

    test('keeps table rows and headings while removing all row editing actions', () => {
        const html = renderReadOnly(
            {
                name: 'data',
                title: 'Measurements',
                kind: 'array_table',
                columns: [
                    {
                        key: 'pressure',
                        label: 'Pressure',
                        type: 'number',
                        required: true,
                    },
                ],
            },
            [[0], [12]],
        );

        expect(html).toContain('Pressure');
        expect(html).toContain('value="0"');
        expect(html).toContain('value="12"');
        expect(html).not.toContain('<button');
        expect(
            html
                .match(/<input\b[^>]*>/g)
                ?.every((input) => input.includes('readOnly=""')),
        ).toBe(true);
    });

    test('removes add and remove actions from arrays of objects', () => {
        const html = renderReadOnly(
            {
                name: 'items',
                title: 'Items',
                kind: 'array_object',
                fields: {
                    name: { name: 'name', title: 'Name', kind: 'scalar' },
                },
            },
            [{ name: 'First' }, { name: 'Second' }],
        );

        expect(html).toContain('value="First"');
        expect(html).toContain('value="Second"');
        expect(html).not.toContain('<button');
    });

    test('shows inline data without upload controls or input mode switches', () => {
        const html = renderReadOnly(
            {
                name: 'data',
                title: 'Measurements',
                kind: 'scalar',
                mediaType: 'text/csv',
            },
            { value: 'pressure,temperature\n0,1200', mediaType: 'text/csv' },
        );

        expect(html).toContain('pressure,temperature');
        expect(html).toContain('readOnly=""');
        expect(html).not.toContain('type="file"');
        expect(html).not.toContain('<button');
    });
});
