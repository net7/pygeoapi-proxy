import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import NumericInput, {
    initialNumericInputDraftState,
    numericInputChange,
    numericInputDraftReducer,
    numericInputViolation,
} from '../../resources/js/components/ogc/numeric-input';

describe('OGC numeric input', () => {
    test('preserves decimal editing text while exposing numeric values', () => {
        expect(numericInputChange('0.01')).toEqual({
            draftValue: '0.01',
            numericValue: 0.01,
        });
        expect(numericInputChange('0.1230')).toEqual({
            draftValue: '0.1230',
            numericValue: 0.123,
        });
        expect(numericInputChange('0,01')).toEqual({
            draftValue: '0,01',
            numericValue: 0.01,
        });
        expect(numericInputChange('not-a-number')).toEqual({
            draftValue: 'not-a-number',
            numericValue: null,
        });
        expect(numericInputChange('0x10')).toEqual({
            draftValue: '0x10',
            numericValue: null,
        });
        expect(numericInputChange('1.2e3')).toEqual({
            draftValue: '1.2e3',
            numericValue: 1200,
        });
    });

    test('reports numeric constraint violations for native live validation', () => {
        expect(numericInputViolation('', {})).toBeNull();
        expect(numericInputViolation('not-a-number', {})).toBe(
            'invalid-number',
        );
        expect(numericInputViolation('1.5', { integer: true })).toBe('integer');
        expect(numericInputViolation('1', { minimum: 2 })).toBe('minimum');
        expect(numericInputViolation('3', { maximum: 2 })).toBe('maximum');
        expect(numericInputViolation('2', { exclusiveMinimum: 2 })).toBe(
            'exclusive-minimum',
        );
        expect(numericInputViolation('2', { exclusiveMaximum: 2 })).toBe(
            'exclusive-maximum',
        );
        expect(
            numericInputViolation('2', {
                integer: true,
                minimum: 2,
                maximum: 2,
            }),
        ).toBeNull();
    });

    test('preserves the draft through controlled parent rerenders', () => {
        let state = initialNumericInputDraftState(null);

        for (const rawValue of ['0', '0.', '0.0', '0.01']) {
            const change = numericInputChange(rawValue);

            state = numericInputDraftReducer(state, {
                type: 'edited',
                change,
            });
            state = numericInputDraftReducer(state, {
                type: 'external-value',
                value: change.numericValue,
            });

            expect(state.draftValue).toBe(rawValue);
        }

        for (const rawValue of ['0,', '0,0', '0,01', '0.1230']) {
            const change = numericInputChange(rawValue);

            state = numericInputDraftReducer(state, {
                type: 'edited',
                change,
            });
            state = numericInputDraftReducer(state, {
                type: 'external-value',
                value: change.numericValue,
            });

            expect(state.draftValue).toBe(rawValue);
        }

        state = numericInputDraftReducer(state, {
            type: 'external-value',
            value: 5,
        });

        expect(state.draftValue).toBe('5');
    });

    test('renders a text-backed decimal control', () => {
        const html = renderToStaticMarkup(
            <NumericInput value={0.123} onValueChange={() => undefined} />,
        );

        expect(html).toContain('type="text"');
        expect(html).toContain('inputMode="decimal"');
        expect(html).toContain('value="0.123"');
    });
});
