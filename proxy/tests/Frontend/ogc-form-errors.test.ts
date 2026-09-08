import { readFileSync } from 'node:fs';
import { describe, expect, mock, test } from 'bun:test';

import {
    errorIdForPath,
    fieldError,
    firstInvalidFieldPath,
    focusFirstInvalidField,
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

    test('chooses the deepest structural target for a nested error', () => {
        const controls = ['outputs', 'outputs.chart', 'outputs.chart.format'];
        const errors = {
            'outputs.chart.format.mediaType': 'Format is invalid.',
        };

        expect(firstInvalidFieldPath(controls, errors)).toBe(
            'outputs.chart.format',
        );
    });

    test('centers and focuses the first invalid control without a second scroll', () => {
        const scrollIntoView = mock(() => undefined);
        const focus = mock(() => undefined);
        const target = {
            dataset: { fieldPath: 'inputs.value' },
            scrollIntoView,
            focus,
        } as unknown as HTMLElement;
        const form = {
            querySelectorAll: () => [target],
        } as unknown as HTMLFormElement;

        expect(
            focusFirstInvalidField(form, {
                'inputs.value': 'Complete this field.',
            }),
        ).toBe(true);
        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
        });
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    test('prefers the natively invalid control when a path has multiple controls', () => {
        const selectFocus = mock(() => undefined);
        const inputFocus = mock(() => undefined);
        const inputScroll = mock(() => undefined);
        const referenceSelect = {
            dataset: { fieldPath: 'inputs.reference' },
            matches: () => false,
            scrollIntoView: mock(() => undefined),
            focus: selectFocus,
        } as unknown as HTMLElement;
        const invalidUrlInput = {
            dataset: { fieldPath: 'inputs.reference' },
            matches: (selector: string) => selector === ':invalid',
            scrollIntoView: inputScroll,
            focus: inputFocus,
        } as unknown as HTMLElement;
        const form = {
            querySelectorAll: () => [referenceSelect, invalidUrlInput],
        } as unknown as HTMLFormElement;

        expect(
            focusFirstInvalidField(form, {
                'inputs.reference': 'Inserisci un URL valido.',
            }),
        ).toBe(true);
        expect(inputScroll).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
        });
        expect(inputFocus).toHaveBeenCalledWith({ preventScroll: true });
        expect(selectFocus).not.toHaveBeenCalled();
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
        expect(form).toContain('validation.focusErrors');
        expect(renderer).toContain('data-field-path');
        expect(renderer).toContain('aria-invalid');
        expect(table).toMatch(/required=\{\s*!readOnly\s*&&\s*column\.required\s*\}/);
        expect(table).toContain('OgcFieldError');
        expect(table).toContain('OgcValidationControl');
        expect(table).not.toContain('@/components/input-error');
        expect(dataInput).not.toContain('fieldPath={path}');
    });
});
