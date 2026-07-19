import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import ArrayTableField from '../../resources/js/components/ogc/array-table-field';
import type { OgcFieldValidationController } from '../../resources/js/lib/ogc-form-validation';
import type { OgcNormalizedField } from '../../resources/js/types';

const field: OgcNormalizedField = {
    name: 'sw.data',
    title: 'User data',
    description: 'User-defined conditions.',
    kind: 'array_table',
    minItems: 1,
    maxItems: 4,
    columns: [
        {
            key: 'pressure',
            label: 'Pressure',
            type: 'number',
            required: true,
        },
        {
            key: 'temperature',
            label: 'Temperature',
            type: 'number',
            required: true,
        },
        {
            key: 'h2o',
            label: 'H2O',
            type: 'number',
            required: true,
        },
        {
            key: 'co2',
            label: 'CO2',
            type: 'number',
            required: true,
        },
    ],
};

function validationController(): OgcFieldValidationController {
    const errors = {
        'inputs.sw.data.0.1': 'Compila questo campo.',
    };

    return {
        errors,
        validLabel: 'Campo valido',
        stateFor: (_path, error) => (error ? 'invalid' : 'neutral'),
        fieldChanged: () => undefined,
        resetPathPrefix: () => undefined,
        valuesReplaced: () => undefined,
    };
}

function renderField(): string {
    return renderToStaticMarkup(
        <ArrayTableField
            field={field}
            value={[['1000', '', '0.03', '0.01']]}
            onChange={() => undefined}
            path="inputs.sw.data"
            validation={validationController()}
        />,
    );
}

describe('ArrayTableField', () => {
    test('renders one responsive and accessible control tree', () => {
        const html = renderField();

        expect(
            html.match(/data-field-path="inputs\.sw\.data\.0\.0"/g),
        ).toHaveLength(1);
        expect(
            html.match(/data-field-path="inputs\.sw\.data\.0\.1"/g),
        ).toHaveLength(1);
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="User data (sw.data)"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain(
            'aria-describedby="error-inputs-sw-data-scroll-hint"',
        );
        expect(html).toContain('id="error-inputs-sw-data-scroll-hint"');
        expect(html).toContain('Scorri orizzontalmente');
        expect(html).toContain('Riga 1');
        expect(html).toContain('for="error-inputs-sw-data-0-0-control"');
        expect(html).toContain('Pressure');
    });

    test('keeps errors aligned and actions available in both layouts', () => {
        const html = renderField();

        expect(html).toContain('block w-full md:table');
        expect(html).toContain('hidden md:table-header-group');
        expect(html).toContain('flex flex-col');
        expect(html).toContain('md:table-row');
        expect(html).toContain('md:table-fixed');
        expect(html).toContain('md:min-w-[var(--array-table-min-width)]');
        expect(html).toContain('style="--array-table-min-width:35.5rem"');
        expect(html).toContain('align-top');
        expect(html).toContain('md:table-cell');
        expect(html).toContain('w-32');
        expect(html).not.toContain('md:min-w-40');
        expect(html).toContain('break-words');
        expect(html).toContain('order-first');
        expect(html).toContain('md:sticky');
        expect(html).toContain('md:right-0');
        expect(html).toContain('md:sr-only');
        expect(html).toContain('aria-describedby="error-inputs-sw-data-0-1"');
        expect(html).toContain('text-xs');
        expect(html).toContain('w-full md:w-auto');
    });
});
