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
        expect(form).toContain('onChange={validation.handleFormChange}');
        expect(form).not.toContain(
            'onChangeCapture={validation.handleFormChange}',
        );
        expect(form).toContain('if (!validation.validateForm())');
        expect(form).toContain('validation.focusErrors');
        expect(form).toContain('validation.errors');
    });

    test('gates the Inertia submit with Ajv errors from the service input schema', () => {
        const form = source(
            'resources/js/components/ogc/dynamic-process-form.tsx',
        );
        const hook = source('resources/js/hooks/use-ogc-form-validation.ts');

        expect(form).toContain("from '@/lib/ogc-ajv-validation'");
        expect(form).toContain('schema.inputValidationSchema');
        expect(form).toContain('collectAdditionalErrors');
        expect(hook).toContain('collectAdditionalErrors');
        expect(hook).toContain('mergeOgcFormErrors');
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
        expect(hook).toContain('tracksClientValidationState');
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
        expect(dataInput).toContain('validationState={state}');
        expect(oneOf).toContain('validationState={sectionState}');
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
        expect(renderer).toContain('ogcValidationFieldClassName');
        expect(table).toContain('OgcValidationControl');
        expect(table).toContain('ogcValidationControlClassName');
    });

    test('keeps numeric editing text separate from the Ajv value', () => {
        const renderer = source(
            'resources/js/components/ogc/schema-field-renderer.tsx',
        );

        expect(renderer).not.toContain('Number.parseInt(raw, 10)');
        expect(renderer).not.toContain('? Number(raw)');
        expect(renderer).toContain('<NumericInput');
        expect(renderer).toContain('onValueChange={onChange}');
    });

    test('maps output and format errors to focusable dotted paths', () => {
        const outputs = source(
            'resources/js/components/ogc/process-output-selector.tsx',
        );

        expect(outputs).toContain("const outputPath = 'outputs.' + outputId");
        expect(outputs).toContain("const formatPath = outputPath + '.format'");
        expect(outputs).toContain('data-field-path={outputPath}');
        expect(outputs).toContain('data-field-path={formatPath}');
        expect(outputs).toContain('OgcFieldError');
        expect(outputs).not.toContain('@/components/input-error');
    });

    test('styles the empty output notice as informational feedback', () => {
        const outputs = source(
            'resources/js/components/ogc/process-output-selector.tsx',
        );

        expect(outputs).toContain('border-info-emphasis');
        expect(outputs).toContain('bg-info/10');
        expect(outputs).toContain('text-info-emphasis');
        expect(outputs).toContain(
            '*:data-[slot=alert-description]:text-info-emphasis/80',
        );
        expect(outputs).not.toContain('<Alert variant="destructive">');
    });
});
