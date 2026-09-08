import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
    InputSupport,
    InputSupportContext,
    InputSupportToggle,
} from '../../resources/js/components/ogc/input-support';
import SchemaFieldRenderer from '../../resources/js/components/ogc/schema-field-renderer';
import { TooltipProvider } from '../../resources/js/components/ui/tooltip';
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

const scalar: OgcNormalizedField = {
    name: 'max_distance',
    title: 'Maximum distance',
    kind: 'scalar',
    type: 'number',
};

const fields: [string, OgcNormalizedField, unknown, string[]][] = [
    ['scalar', scalar, 100, ['max_distance']],
    [
        'enum',
        { ...scalar, kind: 'enum', options: [100, 200] },
        100,
        ['max_distance'],
    ],
    [
        'object',
        {
            name: 'options',
            title: 'Options',
            kind: 'object',
            fields: { max_distance: scalar },
        },
        { max_distance: 100 },
        ['options', 'max_distance'],
    ],
    [
        'variant',
        {
            name: 'mode',
            title: 'Search mode',
            kind: 'oneOf',
            variants: [
                {
                    id: '0',
                    label: 'Distance search',
                    required: [],
                    fields: { max_distance: scalar },
                },
            ],
        },
        { variant: '0', value: { max_distance: 100 } },
        ['mode', 'max_distance'],
    ],
    [
        'object array',
        {
            name: 'samples',
            title: 'Samples',
            kind: 'array_object',
            fields: { max_distance: scalar },
        },
        [{ max_distance: 100 }],
        ['samples', 'max_distance'],
    ],
    [
        'table',
        {
            name: 'measurements',
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
        [[100]],
        ['measurements', 'pressure'],
    ],
    [
        'data input',
        {
            name: 'dataset',
            title: 'Dataset',
            kind: 'scalar',
            mediaType: 'text/csv',
        },
        { value: 'pressure\n100', mediaType: 'text/csv' },
        ['dataset'],
    ],
];

describe('input support references', () => {
    test.each(['', 'max_distance'])(
        'shows only the clickable reference when no distinct title is available',
        (title) => {
            const html = renderToStaticMarkup(
                <InputSupportContext
                    value={{
                        showReferences: true,
                        toggleReferences: () => undefined,
                    }}
                >
                    <SchemaFieldRenderer
                        field={{ ...scalar, title }}
                        value={100}
                        path="inputs.example"
                        validation={validation}
                        onChange={() => undefined}
                        readOnly
                    />
                </InputSupportContext>,
            );

            const label = html.match(/<label\b[^>]*>[\s\S]*?<\/label>/)?.[0];
            expect(label?.includes('sr-only')).toBe(true);
            expect(html.includes('>(max_distance)</code>')).toBe(true);
        },
    );

    test('does not duplicate the reference in a title-less section legend', () => {
        const html = renderToStaticMarkup(
            <InputSupportContext
                value={{
                    showReferences: true,
                    toggleReferences: () => undefined,
                }}
            >
                <SchemaFieldRenderer
                    field={{
                        name: 'settings',
                        title: 'settings',
                        kind: 'object',
                        fields: {},
                    }}
                    value={{}}
                    path="inputs.settings"
                    validation={validation}
                    onChange={() => undefined}
                />
            </InputSupportContext>,
        );
        const legend =
            html.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/)?.[1] ?? '';

        expect(legend.replace(/<button\b[\s\S]*?<\/button>/g, '').trim()).toBe(
            '',
        );
        expect(legend.includes('>(settings)</code>')).toBe(true);
    });

    test('starts with the support command off and keeps the input visible', () => {
        const html = renderToStaticMarkup(
            <TooltipProvider>
                <InputSupport>
                    <InputSupportToggle />
                    <SchemaFieldRenderer
                        field={scalar}
                        value={100}
                        path="inputs.max_distance"
                        validation={validation}
                        onChange={() => undefined}
                    />
                </InputSupport>
            </TooltipProvider>,
        );

        expect(html).toContain('Show support references');
        expect(html).toContain('aria-pressed="false"');
        expect(html).not.toContain('Support ref:');
        expect(html).not.toContain('(max_distance)');
        expect(html).toContain('value="100"');
    });

    for (const readOnly of [false, true]) {
        test.each(fields)(
            `shows copyable references for %s fields with readOnly=${readOnly}`,
            (_kind, field, value, references) => {
                const html = renderToStaticMarkup(
                    <InputSupportContext
                        value={{
                            showReferences: true,
                            toggleReferences: () => undefined,
                        }}
                    >
                        <SchemaFieldRenderer
                            field={field}
                            value={value}
                            path="inputs.example"
                            validation={validation}
                            onChange={() => undefined}
                            readOnly={readOnly}
                        />
                    </InputSupportContext>,
                );

                expect(html.includes('Support ref:')).toBe(false);

                for (const reference of references) {
                    expect(html.includes(`>(${reference})</code>`)).toBe(true);
                    expect(html).toContain(
                        `aria-label="Copy support reference ${reference}"`,
                    );
                }

                expect(html).not.toMatch(/<label[^>]*>[^<]*\([^<]*\)<\/label>/);

                for (const label of html.match(
                    /<label\b[^>]*>[\s\S]*?<\/label>/g,
                ) ?? []) {
                    expect(label).not.toContain('<button');
                }
            },
        );
    }

    test('escapes technical references supplied by a process schema', () => {
        const html = renderToStaticMarkup(
            <InputSupportContext
                value={{
                    showReferences: true,
                    toggleReferences: () => undefined,
                }}
            >
                <SchemaFieldRenderer
                    field={{ ...scalar, name: '<script>alert(1)</script>' }}
                    value={0}
                    path="inputs.example"
                    validation={validation}
                    onChange={() => undefined}
                />
            </InputSupportContext>,
        );

        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
    });
});
