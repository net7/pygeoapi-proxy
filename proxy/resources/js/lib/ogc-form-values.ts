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
    inputs: Record<string, unknown> = {},
): Record<string, unknown> {
    const defaults = Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter((entry) => entry[1] !== undefined),
    );

    return {
        ...defaults,
        ...exampleInputsToFormValues(fields, inputs),
    };
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
        Object.entries(pruneOptionalInputValues(fields, inputs)).map(
            ([name, value]) => [name, normalizeValue(value, fields[name])],
        ),
    );
}

export function pruneOptionalInputValues(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    const pruned: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(inputs)) {
        const field = fields[name];

        if (!field) {
            pruned[name] = value;

            continue;
        }

        const result = pruneFieldValue(field, value);

        if (result.included) {
            pruned[name] = result.value;
        }
    }

    return pruned;
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
                matchesVariant(candidate, objectValue),
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

function matchesVariant(
    variant: NonNullable<OgcNormalizedField['variants']>[number],
    value: Record<string, unknown>,
): boolean {
    const hasProperty = (property: string): boolean =>
        Object.prototype.hasOwnProperty.call(value, property);

    if (!variant.required.every(hasProperty)) {
        return false;
    }

    if (
        Object.keys(value).some(
            (property) =>
                !Object.prototype.hasOwnProperty.call(variant.fields, property),
        )
    ) {
        return false;
    }

    return Object.entries(variant.fields).every(([property, field]) => {
        if (!hasProperty(property) || !field.options?.length) {
            return true;
        }

        return field.options.some((option) => option === value[property]);
    });
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

type PrunedFieldValue =
    { included: false } | { included: true; value: unknown };

function pruneFieldValue(
    field: OgcNormalizedField,
    value: unknown,
): PrunedFieldValue {
    const required = isRequiredField(field);

    if (isBlankScalar(value)) {
        return required ? { included: true, value } : { included: false };
    }

    if (field.kind === 'oneOf' && isOneOfValue(value)) {
        const variant = field.variants?.find(
            (candidate) => candidate.id === value.variant,
        );
        const prunedValue = pruneObjectValues(
            variant?.fields ?? {},
            value.value,
        );

        if (!required && Object.keys(prunedValue).length === 0) {
            return { included: false };
        }

        return {
            included: true,
            value: { ...value, value: prunedValue },
        };
    }

    if (field.kind === 'object') {
        const wrapped =
            isRecord(value) &&
            Object.prototype.hasOwnProperty.call(value, 'value') &&
            isRecord(value.value);
        const objectValue = wrapped ? value.value : value;

        if (!isRecord(objectValue)) {
            return { included: true, value };
        }

        const prunedValue = pruneObjectValues(field.fields ?? {}, objectValue);

        if (!required && Object.keys(prunedValue).length === 0) {
            return { included: false };
        }

        return {
            included: true,
            value: wrapped ? { ...value, value: prunedValue } : prunedValue,
        };
    }

    if (field.kind === 'array_object' && Array.isArray(value)) {
        if (!required && value.length === 0) {
            return { included: false };
        }

        return {
            included: true,
            value: value.map((item) =>
                isRecord(item)
                    ? pruneObjectValues(field.fields ?? {}, item)
                    : item,
            ),
        };
    }

    if (Array.isArray(value) && !required && value.length === 0) {
        return { included: false };
    }

    return { included: true, value };
}

function pruneObjectValues(
    fields: Record<string, OgcNormalizedField>,
    values: Record<string, unknown>,
): Record<string, unknown> {
    const pruned: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(values)) {
        const field = fields[name];

        if (!field) {
            pruned[name] = value;

            continue;
        }

        const result = pruneFieldValue(field, value);

        if (result.included) {
            pruned[name] = result.value;
        }
    }

    return pruned;
}

function isRequiredField(field: OgcNormalizedField): boolean {
    return field.required === true || Number(field.minOccurs) > 0;
}

function isBlankScalar(value: unknown): boolean {
    return (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
    );
}

function normalizeValue(value: unknown, field?: OgcNormalizedField): unknown {
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
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
