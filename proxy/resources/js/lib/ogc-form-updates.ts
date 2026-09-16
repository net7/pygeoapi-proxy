import { isOneOfValue } from '@/lib/ogc-form-values';

// Preserve row identity across edits while an earlier render is still visible.
// Metadata stays outside the submitted form values.
const rowOrigins = new WeakMap<object, object>();

function rowIdentity(row: unknown): unknown {
    return typeof row === 'object' && row !== null
        ? (rowOrigins.get(row) ?? row)
        : row;
}

function applyUpdate(current: unknown, update: unknown): unknown {
    return typeof update === 'function' ? update(current) : update;
}

export function updateFormProperty(
    current: unknown,
    key: string,
    update: unknown,
): Record<string, unknown> {
    const object =
        typeof current === 'object' &&
        current !== null &&
        !Array.isArray(current)
            ? (current as Record<string, unknown>)
            : {};

    return { ...object, [key]: applyUpdate(object[key], update) };
}

export function updateFormRow(
    current: unknown,
    renderedRow: unknown,
    update: unknown,
): unknown[] {
    const rows = Array.isArray(current) ? current : [];
    const index = rows.findIndex(
        (row) => rowIdentity(row) === rowIdentity(renderedRow),
    );

    if (index < 0) {
        return rows;
    }

    const updated = applyUpdate(rows[index], update);

    if (
        typeof updated === 'object' &&
        updated !== null &&
        typeof renderedRow === 'object' &&
        renderedRow !== null
    ) {
        rowOrigins.set(updated, rowIdentity(renderedRow) as object);
    }

    return rows.map((row, rowIndex) => (rowIndex === index ? updated : row));
}

export function appendFormRow(
    current: unknown,
    row: unknown,
    maximum?: number | null,
): unknown[] {
    const rows = Array.isArray(current) ? current : [];

    return maximum != null && rows.length >= maximum ? rows : [...rows, row];
}

export function removeFormRow(
    current: unknown,
    renderedRow: unknown,
    minimum?: number | null,
): unknown[] {
    const rows = Array.isArray(current) ? current : [];
    const index = rows.findIndex(
        (row) => rowIdentity(row) === rowIdentity(renderedRow),
    );

    return index < 0 || (minimum != null && rows.length <= minimum)
        ? rows
        : rows.filter((_, rowIndex) => rowIndex !== index);
}

export function updateVariantProperty(
    current: unknown,
    variant: string,
    key: string,
    update: unknown,
): unknown {
    const selected = isOneOfValue(current) ? current : { variant, value: {} };

    if (selected.variant !== variant) {
        return current;
    }

    return {
        ...selected,
        value: updateFormProperty(selected.value, key, update),
    };
}
