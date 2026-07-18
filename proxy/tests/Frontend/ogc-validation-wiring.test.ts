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

    test('clears exact server paths and revalidates only prior client errors', () => {
        const hook = source('resources/js/hooks/use-ogc-form-validation.ts');

        expect(hook).toContain('clearServerErrors(path)');
        expect(hook).toContain('lifecycle.clientErrors');
        expect(hook).toContain("type: 'field-corrected'");
        expect(hook).toContain('collectFormConstraintErrors');
        expect(hook).toContain('requestAnimationFrame');
    });
});
