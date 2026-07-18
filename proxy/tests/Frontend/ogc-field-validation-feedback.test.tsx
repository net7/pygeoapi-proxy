import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
    ogcValidationFieldClassName,
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
        expect(html).toContain('text-destructive-emphasis');
        expect(html).toContain('border-destructive-emphasis');
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
            'aria-invalid:border-destructive-emphasis',
        );
        expect(ogcValidationControlClassName('invalid')).toContain(
            'ring-destructive-emphasis/80',
        );
        expect(ogcValidationControlClassName('corrected')).toContain(
            'ring-success/20',
        );
        expect(ogcValidationFieldClassName('invalid')).toContain(
            'data-[invalid=true]:text-destructive-emphasis',
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

    test('uses coherent semantic colors for every toast type', () => {
        const toaster = readFileSync(
            'resources/js/components/ui/sonner.tsx',
            'utf8',
        );
        const css = readFileSync('resources/css/app.css', 'utf8');

        for (const type of ['normal', 'success', 'info', 'warning', 'error']) {
            expect(toaster).toContain(`'--${type}-bg'`);
            expect(toaster).toContain(`'--${type}-text'`);
            expect(toaster).toContain(`'--${type}-border'`);
        }

        expect(toaster).toContain(
            "'--error-text': 'var(--destructive-emphasis)'",
        );
        expect(toaster).toContain(
            "'--error-border': 'var(--destructive-emphasis)'",
        );
        expect(toaster).toContain(
            "'--success-text': 'var(--success-emphasis)'",
        );
        expect(toaster).toContain("'--info-text': 'var(--info-emphasis)'");
        expect(toaster).toContain(
            "'--warning-text': 'var(--warning-emphasis)'",
        );
        expect(css).toContain(
            '--color-destructive-emphasis: var(--destructive-emphasis)',
        );
        expect(css).toContain(
            '--color-success-emphasis: var(--success-emphasis)',
        );
        expect(css).toContain('--color-info: var(--info)');
        expect(css).toContain('--color-warning: var(--warning)');
        expect(css).toContain('--color-info-emphasis: var(--info-emphasis)');
        expect(css).toContain(
            '--color-warning-emphasis: var(--warning-emphasis)',
        );
        expect(css.match(/--destructive-emphasis:/g)).toHaveLength(2);
        expect(css.match(/--success-emphasis:/g)).toHaveLength(2);
        expect(css.match(/--info-emphasis:/g)).toHaveLength(2);
        expect(css.match(/--warning-emphasis:/g)).toHaveLength(2);
        expect(css.match(/--info:/g)).toHaveLength(2);
        expect(css.match(/--warning:/g)).toHaveLength(2);
    });
});
