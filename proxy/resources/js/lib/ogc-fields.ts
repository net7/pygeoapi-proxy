import type { OgcNormalizedField } from '@/types';

export function fieldDisplayLabel(
    field: Pick<OgcNormalizedField, 'name' | 'title'>,
): string {
    return field.title?.trim() || field.name;
}

export function optionDisplayLabel(option: string | number | boolean): string {
    return String(option);
}

export function referenceDisplayLabel(reference: {
    label: string;
    href: string;
}): string {
    return `${reference.label}: ${reference.href}`;
}
