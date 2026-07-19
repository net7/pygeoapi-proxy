import type { ComponentProps } from 'react';
import { useEffect, useReducer, useRef } from 'react';

import { Input } from '@/components/ui/input';

const noEmittedNumericValue = Symbol('no-emitted-numeric-value');
const decimalNumberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

type NumericInputProps = Omit<
    ComponentProps<typeof Input>,
    'inputMode' | 'onChange' | 'type' | 'value'
> &
    NumericInputConstraints & {
        value: unknown;
        onValueChange: (value: number | null) => void;
    };

type NumericInputConstraints = {
    integer?: boolean;
    minimum?: number | null;
    maximum?: number | null;
    exclusiveMinimum?: number | null;
    exclusiveMaximum?: number | null;
};

type NumericInputViolation =
    | 'invalid-number'
    | 'integer'
    | 'minimum'
    | 'maximum'
    | 'exclusive-minimum'
    | 'exclusive-maximum'
    | null;

type NumericInputChange = {
    draftValue: string;
    numericValue: number | null;
};

type NumericInputDraftState = {
    draftValue: string;
    lastEmittedValue: number | null | typeof noEmittedNumericValue;
};

type NumericInputDraftAction =
    | { type: 'edited'; change: NumericInputChange }
    | { type: 'external-value'; value: unknown };

export function numericInputChange(rawValue: string): NumericInputChange {
    const normalizedValue = rawValue.trim().replace(',', '.');
    const parsedValue = decimalNumberPattern.test(normalizedValue)
        ? Number(normalizedValue)
        : Number.NaN;

    return {
        draftValue: rawValue,
        numericValue: Number.isFinite(parsedValue) ? parsedValue : null,
    };
}

export function initialNumericInputDraftState(
    value: unknown,
): NumericInputDraftState {
    return {
        draftValue: value === null || value === undefined ? '' : String(value),
        lastEmittedValue: noEmittedNumericValue,
    };
}

export function numericInputDraftReducer(
    state: NumericInputDraftState,
    action: NumericInputDraftAction,
): NumericInputDraftState {
    if (action.type === 'edited') {
        return {
            draftValue: action.change.draftValue,
            lastEmittedValue: action.change.numericValue,
        };
    }

    if (
        state.lastEmittedValue !== noEmittedNumericValue &&
        Object.is(action.value, state.lastEmittedValue)
    ) {
        return {
            ...state,
            lastEmittedValue: noEmittedNumericValue,
        };
    }

    const nextDraftValue =
        action.value === null || action.value === undefined
            ? ''
            : String(action.value);

    if (
        state.lastEmittedValue === noEmittedNumericValue &&
        state.draftValue === nextDraftValue
    ) {
        return state;
    }

    return {
        draftValue: nextDraftValue,
        lastEmittedValue: noEmittedNumericValue,
    };
}

export function numericInputViolation(
    rawValue: string,
    {
        integer = false,
        minimum,
        maximum,
        exclusiveMinimum,
        exclusiveMaximum,
    }: NumericInputConstraints,
): NumericInputViolation {
    if (rawValue === '') {
        return null;
    }

    const { numericValue } = numericInputChange(rawValue);

    if (numericValue === null) {
        return 'invalid-number';
    }

    if (integer && !Number.isInteger(numericValue)) {
        return 'integer';
    }

    if (typeof minimum === 'number' && numericValue < minimum) {
        return 'minimum';
    }

    if (typeof maximum === 'number' && numericValue > maximum) {
        return 'maximum';
    }

    if (
        typeof exclusiveMinimum === 'number' &&
        numericValue <= exclusiveMinimum
    ) {
        return 'exclusive-minimum';
    }

    if (
        typeof exclusiveMaximum === 'number' &&
        numericValue >= exclusiveMaximum
    ) {
        return 'exclusive-maximum';
    }

    return null;
}

function applyNumericInputValidity(
    input: HTMLInputElement,
    rawValue: string,
    constraints: NumericInputConstraints,
): void {
    const violation = numericInputViolation(rawValue, constraints);

    input.setCustomValidity(violation ? 'invalid' : '');

    if (violation) {
        input.dataset.numericValidation = violation;

        return;
    }

    delete input.dataset.numericValidation;
}

export default function NumericInput({
    value,
    onValueChange,
    integer = false,
    minimum,
    maximum,
    exclusiveMinimum,
    exclusiveMaximum,
    ...props
}: NumericInputProps) {
    const [draftState, dispatchDraft] = useReducer(
        numericInputDraftReducer,
        value,
        initialNumericInputDraftState,
    );
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        dispatchDraft({ type: 'external-value', value });
    }, [value]);

    useEffect(() => {
        if (inputRef.current) {
            applyNumericInputValidity(inputRef.current, draftState.draftValue, {
                integer,
                minimum,
                maximum,
                exclusiveMinimum,
                exclusiveMaximum,
            });
        }
    }, [
        draftState.draftValue,
        exclusiveMaximum,
        exclusiveMinimum,
        integer,
        maximum,
        minimum,
    ]);

    return (
        <Input
            {...props}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={draftState.draftValue}
            onChange={(event) => {
                const nextValue = numericInputChange(event.target.value);

                applyNumericInputValidity(
                    event.currentTarget,
                    nextValue.draftValue,
                    {
                        integer,
                        minimum,
                        maximum,
                        exclusiveMinimum,
                        exclusiveMaximum,
                    },
                );
                dispatchDraft({ type: 'edited', change: nextValue });
                onValueChange(nextValue.numericValue);
            }}
        />
    );
}
