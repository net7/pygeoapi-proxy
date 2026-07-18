import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
} from '../../resources/js/components/ogc/field-validation-feedback';

describe('OGC field validation feedback', () => {
    test('renders an accessible destructive error box', () => {
        const html = renderToStaticMarkup(
            <OgcFieldError
                id="error-inputs-value"
                message="Complete this field."
            />,
        );

        expect(html).toContain('role="alert"');
        expect(html).toContain('error-inputs-value');
        expect(html).toContain('Complete this field.');
        expect(html).toContain('bg-destructive/10');
        expect(html).toContain('text-destructive-foreground');
    });

    test('renders a corrected status only for corrected fields', () => {
        const html = renderToStaticMarkup(
            <OgcValidationControl state="corrected" validLabel="Campo valido">
                <input />
            </OgcValidationControl>,
        );

        expect(html).toContain('role="status"');
        expect(html).toContain('Campo valido');
        expect(html).toContain('text-success');
        expect(
            renderToStaticMarkup(
                <OgcValidationControl state="neutral" validLabel="Campo valido">
                    <input />
                </OgcValidationControl>,
            ),
        ).not.toContain('role="status"');
    });

    test('returns persistent semantic error and success border-ring classes', () => {
        expect(ogcValidationControlClassName('invalid')).toContain(
            'ring-destructive/20',
        );
        expect(ogcValidationControlClassName('corrected')).toContain(
            'ring-success/20',
        );
        expect(ogcValidationDataState('corrected')).toBe('valid');
        expect(ogcValidationDataState('neutral')).toBeUndefined();
    });

    test('defines adaptive success tokens for light and dark themes', () => {
        const css = readFileSync('resources/css/app.css', 'utf8');

        expect(css).toContain('--color-success: var(--success)');
        expect(css.match(/--success:/g)).toHaveLength(2);
        expect(css.match(/--success-foreground:/g)).toHaveLength(2);
    });
});
