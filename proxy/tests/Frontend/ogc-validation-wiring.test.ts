import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

function source(path: string): string {
    return readFileSync(path, 'utf8');
}

describe('OGC validation wiring', () => {
    test('gates the Inertia submit with all native constraint errors', () => {
        const form = source(
            'resources/js/components/ogc/dynamic-process-form.tsx',
        );

        expect(form).toContain('useOgcFormValidation');
        expect(form).toContain('noValidate');
        expect(form).toContain('onChangeCapture={validation.handleFormChange}');
        expect(form).toContain('if (!validation.validateForm())');
        expect(form).toContain('validation.focusErrors');
        expect(form).toContain('validation.errors');
    });

    test('uses an error toast instead of a generic validation alert', () => {
        const form = source(
            'resources/js/components/ogc/dynamic-process-form.tsx',
        );

        expect(form).toContain("import { toast } from 'sonner'");
        expect(form).toContain('toast.error');
        expect(form).toContain('notifyValidationFailure()');
        expect(form).not.toContain('<Alert variant="destructive">');
    });

    test('clears exact server paths and revalidates only prior client errors', () => {
        const hook = source('resources/js/hooks/use-ogc-form-validation.ts');

        expect(hook).toContain('clearServerErrors(path)');
        expect(hook).toContain('lifecycle.clientErrors');
        expect(hook).toContain("type: 'field-corrected'");
        expect(hook).toContain('collectFormConstraintErrors');
        expect(hook).toContain('requestAnimationFrame');
    });

    test('uses OGC feedback instead of shared plain errors in every field kind', () => {
        const files = [
            'resources/js/components/ogc/section-field-set.tsx',
            'resources/js/components/ogc/schema-field-renderer.tsx',
            'resources/js/components/ogc/one-of-field.tsx',
            'resources/js/components/ogc/array-table-field.tsx',
            'resources/js/components/ogc/data-input-field.tsx',
        ];

        for (const file of files) {
            const contents = source(file);

            expect(contents).toContain('OgcFieldError');
            expect(contents).not.toContain('@/components/input-error');
        }
    });

    test('clears only structurally obsolete variant and row paths', () => {
        const oneOf = source('resources/js/components/ogc/one-of-field.tsx');
        const table = source(
            'resources/js/components/ogc/array-table-field.tsx',
        );
        const objects = source(
            'resources/js/components/ogc/array-object-field.tsx',
        );
        const dataInput = source(
            'resources/js/components/ogc/data-input-field.tsx',
        );

        expect(oneOf).toMatch(/resetPathPrefix\(\s*path \+ '\.value',?\s*\)/);
        expect(table).toMatch(/resetPathPrefix\(\s*path,?\s*\)/);
        expect(objects).toMatch(/resetPathPrefix\(\s*path,?\s*\)/);
        expect(dataInput).toMatch(/resetPathPrefix\(\s*path,?\s*\)/);
    });

    test('renders corrected icons and data state on scalar, enum, and table controls', () => {
        const renderer = source(
            'resources/js/components/ogc/schema-field-renderer.tsx',
        );
        const table = source(
            'resources/js/components/ogc/array-table-field.tsx',
        );

        expect(renderer).toContain('OgcValidationControl');
        expect(renderer).toContain('data-validation-state');
        expect(table).toContain('OgcValidationControl');
        expect(table).toContain('ogcValidationControlClassName');
    });
});
