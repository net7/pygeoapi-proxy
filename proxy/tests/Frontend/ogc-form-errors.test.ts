import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
    errorIdForPath,
    fieldError,
    firstInvalidFieldPath,
    oneOfStructuralError,
} from '../../resources/js/lib/ogc-form-errors';

describe('OGC form errors', () => {
    test('reads exact dotted Inertia errors', () => {
        const errors = {
            'inputs.swinput.data.value.iopen': 'This input is required.',
        };

        expect(fieldError(errors, 'inputs.swinput.data.value.iopen')).toBe(
            'This input is required.',
        );
        expect(errorIdForPath('inputs.swinput.data.value.iopen')).toBe(
            'error-inputs-swinput-data-value-iopen',
        );
    });

    test('prefers an exact child control over an earlier parent container', () => {
        const controls = [
            'inputs.swinput.data',
            'inputs.swinput.data.variant',
            'inputs.swinput.data.value.ndat1',
            'inputs.swinput.data.value.iopen',
        ];
        const errors = {
            'inputs.swinput.data.value.iopen': 'This input is required.',
        };

        expect(firstInvalidFieldPath(controls, errors)).toBe(
            'inputs.swinput.data.value.iopen',
        );
    });

    test('falls back to the closest structural control', () => {
        const controls = ['inputs.sw.data', 'inputs.sw.data.0.0'];
        const errors = {
            'inputs.sw.data.0': 'This row must be an array.',
        };

        expect(firstInvalidFieldPath(controls, errors)).toBe('inputs.sw.data');
    });

    test('surfaces only exact one of container and value wrapper errors', () => {
        const path = 'inputs.swinput.data';

        expect(
            oneOfStructuralError(
                { [path + '.value']: 'This input must be an object.' },
                path,
            ),
        ).toBe('This input must be an object.');
        expect(
            oneOfStructuralError(
                { [path + '.value.iopen']: 'This input is required.' },
                path,
            ),
        ).toBeUndefined();
    });

    test('wires failed submit focus and field accessibility', () => {
        const form = readFileSync(
            'resources/js/components/ogc/dynamic-process-form.tsx',
            'utf8',
        );
        const renderer = readFileSync(
            'resources/js/components/ogc/schema-field-renderer.tsx',
            'utf8',
        );
        const table = readFileSync(
            'resources/js/components/ogc/array-table-field.tsx',
            'utf8',
        );
        const dataInput = readFileSync(
            'resources/js/components/ogc/data-input-field.tsx',
            'utf8',
        );

        expect(form).toContain('onError:');
        expect(form).toContain('focusFirstInvalidField');
        expect(renderer).toContain('data-field-path');
        expect(renderer).toContain('aria-invalid');
        expect(table).toContain('required={column.required}');
        expect(table).toContain('InputError');
        expect(dataInput).not.toContain('fieldPath={path}');
    });
});
