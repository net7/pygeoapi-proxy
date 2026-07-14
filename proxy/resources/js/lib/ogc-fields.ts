import type { OgcNormalizedField } from '@/types';

export function fieldDisplayLabel(
    field: Pick<OgcNormalizedField, 'name' | 'title'>,
): string {
    const title = field.title?.trim();

    if (!title || title === field.name) {
        return `(${field.name})`;
    }

    return `${title} (${field.name})`;
}

export function optionDisplayLabel(option: string | number | boolean): string {
    const value = String(option);

    return `${value}: ${value}`;
}

export function referenceDisplayLabel(reference: {
    label: string;
    href: string;
}): string {
    return `${reference.label}: ${reference.href}`;
}
