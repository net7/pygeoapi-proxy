import type { OgcNormalizedField } from '@/types';

export type OneOfValue = {
    variant: string;
    value: Record<string, unknown>;
};

export function exampleInputsToFormValues(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(inputs)
            .filter(([name]) => Boolean(fields[name]))
            .map(([name, value]) => [
                name,
                exampleInputToFormValue(fields[name], value),
            ]),
    );
}

export function initialInputValues(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter((entry) => entry[1] !== undefined),
    );
}

export function defaultObjectValue(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter((entry) => entry[1] !== undefined),
    );
}

export function normalizeInputs(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(inputs).map(([name, value]) => [
            name,
            normalizeValue(value, fields[name]),
        ]),
    );
}

export function isOneOfValue(value: unknown): value is OneOfValue {
    return (
        isRecord(value) &&
        typeof value.variant === 'string' &&
        isRecord(value.value)
    );
}

function exampleInputToFormValue(
    field: OgcNormalizedField,
    input: unknown,
): unknown {
    const value = unwrapExampleValue(input);

    if (field.kind === 'oneOf') {
        const objectValue = isRecord(value) ? value : {};
        const variant =
            field.variants?.find((candidate) =>
                Object.keys(objectValue).some((key) =>
                    Object.prototype.hasOwnProperty.call(
                        candidate.fields,
                        key,
                    ),
                ),
            ) ?? field.variants?.[0];

        if (!variant) {
            return value;
        }

        return {
            variant: variant.id,
            value: {
                ...defaultObjectValue(variant.fields),
                ...objectValue,
            },
        };
    }

    if (field.kind === 'object') {
        return isRecord(value) ? value : {};
    }

    return value;
}

function unwrapExampleValue(value: unknown): unknown {
    if (
        isRecord(value) &&
        Object.prototype.hasOwnProperty.call(value, 'value')
    ) {
        return value.value;
    }

    return value;
}

function defaultFieldValue(field: OgcNormalizedField): unknown {
    if (field.kind === 'enum' && field.options?.length === 1) {
        return field.options[0];
    }

    if (field.kind === 'oneOf') {
        const variant = field.variants?.[0];

        if (!variant) {
            return undefined;
        }

        return {
            variant: variant.id,
            value: defaultObjectValue(variant.fields),
        };
    }

    if (field.kind === 'object' && field.fields) {
        const value = defaultObjectValue(field.fields);

        return Object.keys(value).length > 0 ? value : undefined;
    }

    if (field.kind === 'array_table' && Number(field.minItems) > 0) {
        return Array.from({ length: Number(field.minItems) }, () =>
            (field.columns ?? []).map(() => ''),
        );
    }

    if (field.kind === 'array_object' && Number(field.minItems) > 0) {
        return Array.from({ length: Number(field.minItems) }, () =>
            defaultObjectValue(field.fields ?? {}),
        );
    }

    return undefined;
}

function normalizeValue(
    value: unknown,
    field?: OgcNormalizedField,
): unknown {
    if (isOneOfValue(value)) {
        return {
            variant: value.variant,
            value: toFormValue(value.value),
        };
    }

    if (field?.kind === 'object') {
        return {
            value: toFormValue(value),
        };
    }

    return toFormValue(value);
}

function toFormValue(value: unknown): unknown {
    if (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => toFormValue(item));
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                toFormValue(item),
            ]),
        );
    }

    return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' && value !== null && !Array.isArray(value)
    );
}
