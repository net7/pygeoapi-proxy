import { describe, expect, test } from 'bun:test';

import { translate } from '../../resources/js/lib/i18n/translation';
import {
    collectConstraintErrors,
    initialOgcValidationLifecycle,
    mergeOgcFormErrors,
    ogcConstraintMessage,
    ogcFieldValidationState,
    ogcValidationReducer,
    tracksClientValidationState,
} from '../../resources/js/lib/ogc-form-validation';
import type { OgcConstraintControl } from '../../resources/js/lib/ogc-form-validation';

function control(
    path: string,
    options: Partial<OgcConstraintControl> = {},
): OgcConstraintControl {
    return {
        dataset: { fieldPath: path },
        isConnected: true,
        hidden: false,
        willValidate: true,
        validationMessage: '',
        getAttribute: () => null,
        checkValidity: () => true,
        ...options,
    };
}

describe('OGC form validation', () => {
    test('collects every active constraint error in rendered order', () => {
        const errors = collectConstraintErrors([
            control('inputs.first', {
                validationMessage: 'Complete this field.',
                checkValidity: () => false,
            }),
            control('inputs.second', {
                validationMessage: 'Enter a number.',
                checkValidity: () => false,
            }),
        ]);

        expect(errors).toEqual({
            'inputs.first': 'Complete this field.',
            'inputs.second': 'Enter a number.',
        });
    });

    test('keeps the first message for duplicate paths', () => {
        const errors = collectConstraintErrors([
            control('inputs.reference', {
                validationMessage: 'Enter a URL.',
                checkValidity: () => false,
            }),
            control('inputs.reference', {
                validationMessage: 'Ignore this duplicate.',
                checkValidity: () => false,
            }),
        ]);

        expect(errors).toEqual({
            'inputs.reference': 'Enter a URL.',
        });
    });

    test('uses the app language instead of the browser validation language', () => {
        const errors = collectConstraintErrors(
            [
                control('inputs.required', {
                    validationMessage: 'Please fill out this field.',
                    validity: { valueMissing: true },
                    checkValidity: () => false,
                }),
                control('inputs.url', {
                    validationMessage: 'Please enter a URL.',
                    validity: { typeMismatch: true },
                    getAttribute: (name) => (name === 'type' ? 'url' : null),
                    checkValidity: () => false,
                }),
                control('inputs.minimum', {
                    validationMessage:
                        'Value must be greater than or equal to 5.',
                    validity: { rangeUnderflow: true },
                    getAttribute: (name) => (name === 'min' ? '5' : null),
                    checkValidity: () => false,
                }),
            ],
            (currentControl) =>
                ogcConstraintMessage(currentControl, (key, values) =>
                    translate('it', key, values),
                ),
        );

        expect(errors).toEqual({
            'inputs.required': 'Compila questo campo.',
            'inputs.url': 'Inserisci un URL valido.',
            'inputs.minimum': 'Il valore deve essere maggiore o uguale a 5.',
        });
    });

    test('ignores valid, hidden, disabled, disconnected, and aria-hidden controls', () => {
        expect(
            collectConstraintErrors([
                control('inputs.valid'),
                control('inputs.hidden', {
                    hidden: true,
                    validationMessage: 'Hidden',
                    checkValidity: () => false,
                }),
                control('inputs.disabled', {
                    willValidate: false,
                    validationMessage: 'Disabled',
                    checkValidity: () => false,
                }),
                control('inputs.disconnected', {
                    isConnected: false,
                    validationMessage: 'Disconnected',
                    checkValidity: () => false,
                }),
                control('inputs.ariaHidden', {
                    validationMessage: 'Aria hidden',
                    getAttribute: (name) =>
                        name === 'aria-hidden' ? 'true' : null,
                    checkValidity: () => false,
                }),
            ]),
        ).toEqual({});
    });

    test('lets server errors override client messages on the same path', () => {
        expect(
            mergeOgcFormErrors(
                { 'inputs.value': 'Browser message.' },
                { 'inputs.value': 'Server message.', name: 'Name error.' },
            ),
        ).toEqual({
            'inputs.value': 'Server message.',
            name: 'Name error.',
        });
    });

    test('marks only a previously client-invalid field corrected', () => {
        const invalid = ogcValidationReducer(initialOgcValidationLifecycle, {
            type: 'submitted',
            errors: { 'inputs.value': 'Complete this field.' },
            activePaths: ['inputs.value', 'inputs.untouched'],
        });
        const corrected = ogcValidationReducer(invalid, {
            type: 'field-corrected',
            path: 'inputs.value',
        });
        const untouched = ogcValidationReducer(corrected, {
            type: 'field-corrected',
            path: 'inputs.untouched',
        });

        expect(
            ogcFieldValidationState(
                'inputs.value',
                corrected.clientErrors,
                corrected.correctedPaths,
            ),
        ).toBe('corrected');
        expect(
            ogcFieldValidationState(
                'inputs.untouched',
                untouched.clientErrors,
                untouched.correctedPaths,
            ),
        ).toBe('neutral');
    });

    test('a fresh error overrides corrected state', () => {
        const corrected = {
            clientErrors: {},
            correctedPaths: new Set(['inputs.value']),
        };
        const invalid = ogcValidationReducer(corrected, {
            type: 'field-invalid',
            path: 'inputs.value',
            message: 'Enter a number.',
        });

        expect(
            ogcFieldValidationState(
                'inputs.value',
                invalid.clientErrors,
                invalid.correctedPaths,
            ),
        ).toBe('invalid');
    });

    test('keeps revalidating a corrected field on later edits', () => {
        expect(
            tracksClientValidationState(
                {
                    clientErrors: {},
                    correctedPaths: new Set(['inputs.value']),
                },
                'inputs.value',
            ),
        ).toBe(true);
        expect(
            tracksClientValidationState(
                initialOgcValidationLifecycle,
                'inputs.untouched',
            ),
        ).toBe(false);
    });

    test('prefix reset removes reindexed and unmounted state only', () => {
        const state = {
            clientErrors: {
                'inputs.rows.0.value': 'First row.',
                'inputs.other': 'Other field.',
            },
            correctedPaths: new Set([
                'inputs.rows.1.value',
                'inputs.otherCorrected',
            ]),
        };

        expect(
            ogcValidationReducer(state, {
                type: 'reset-prefix',
                prefix: 'inputs.rows',
            }),
        ).toEqual({
            clientErrors: { 'inputs.other': 'Other field.' },
            correctedPaths: new Set(['inputs.otherCorrected']),
        });
    });
});
