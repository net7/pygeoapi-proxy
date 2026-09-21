import { expect, test } from 'bun:test';
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

function renderField(
    field: OgcNormalizedField,
    value: unknown,
    readOnly = false,
) {
    return renderToStaticMarkup(
        <SchemaFieldRenderer
            field={field}
            value={value}
            path="inputs.example"
            validation={validation}
            onChange={() => undefined}
            readOnly={readOnly}
        />,
    );
}

function labels(html: string, tag = 'label') {
    return Array.from(
        html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g')),
        ([, content]) =>
            content
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim(),
    );
}

test.each([
    [{ minOccurs: 1 }, 'Required'],
    [{ minOccurs: 0 }, 'Optional'],
    [{ required: true }, 'Required'],
    [{ required: false }, 'Optional'],
] as const)(
    'labels scalar fields from their requirement metadata %j',
    (metadata, expected) => {
        const html = renderField(
            {
                name: 'distance',
                title: 'Distance',
                kind: 'scalar',
                type: 'number',
                ...metadata,
            },
            10,
        );

        expect(labels(html)).toContain(`Distance ${expected}`);
    },
);

test.each(['0', '1'])(
    'identifies the optional initial guess in searching mode variant %s',
    (variant) => {
        const numberField = (
            name: string,
            title: string,
            required: boolean,
        ): OgcNormalizedField => ({
            name,
            title,
            kind: 'scalar',
            type: 'number',
            required,
        });
        const field: OgcNormalizedField = {
            name: 'searching_mode',
            title: 'Searching mode',
            kind: 'oneOf',
            minOccurs: 1,
            variants: [
                {
                    id: '0',
                    label: 'Find flow',
                    required: ['d'],
                    fields: {
                        d: numberField('d', 'Diameter', true),
                        fg: numberField('fg', 'Initial flow guess', false),
                    },
                },
                {
                    id: '1',
                    label: 'Find diameter',
                    required: ['f'],
                    fields: {
                        f: numberField('f', 'Flow', true),
                        dg: numberField('dg', 'Initial diameter guess', false),
                    },
                },
            ],
        };

        const html = renderField(field, { variant, value: {} });

        expect(labels(html, 'legend')).toContain('Searching mode Required');
        expect(labels(html)).toEqual(
            variant === '0'
                ? ['Diameter Required', 'Initial flow guess Optional']
                : ['Flow Required', 'Initial diameter guess Optional'],
        );
    },
);

test.each([
    { kind: 'enum', options: [1, 2] },
    { kind: 'object', required: ['child'], fields: {} },
    { kind: 'array_object', fields: {} },
    { kind: 'array_table', columns: [] },
    { kind: 'array_scalar', itemType: 'number' },
    { kind: 'scalar', mediaType: 'text/csv' },
] as const)(
    'shows optionality for the %j field without confusing required children with the parent',
    (configuration) => {
        const field = {
            name: 'example',
            title: 'Example',
            minOccurs: 0,
            ...configuration,
        } as OgcNormalizedField;
        const html = renderField(field, undefined);

        expect([...labels(html), ...labels(html, 'legend')]).toContain(
            'Example Optional',
        );
    },
);

test('labels required and optional table columns in the header and cell labels', () => {
    const html = renderField(
        {
            name: 'samples',
            title: 'Samples',
            kind: 'array_table',
            minOccurs: 1,
            columns: [
                { key: '0', label: 'Pressure', type: 'number', required: true },
                { key: '1', label: 'Note', type: 'string', required: false },
            ],
        },
        [[100, '']],
    );

    expect(labels(html, 'legend')).toContain('Samples Required');
    expect(labels(html, 'th')).toEqual(
        expect.arrayContaining(['Pressure Required', 'Note Optional']),
    );
    expect(labels(html)).toEqual(
        expect.arrayContaining(['Pressure Required', 'Note Optional']),
    );
});

test('keeps input requirement instructions out of submitted input reviews', () => {
    const html = renderField(
        {
            name: 'sample',
            title: 'Sample',
            kind: 'object',
            minOccurs: 1,
            fields: {
                value: {
                    name: 'value',
                    title: 'Value',
                    kind: 'scalar',
                    required: false,
                },
            },
        },
        { value: 1 },
        true,
    );

    expect(html).not.toContain('Required');
    expect(html).not.toContain('Optional');
});
