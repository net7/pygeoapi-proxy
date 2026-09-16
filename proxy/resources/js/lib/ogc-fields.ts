import type { Language } from '@/lib/i18n/languages';
import { translate } from '@/lib/i18n/translation';
import type { OgcNormalizedField } from '@/types';

export function fieldDisplayLabel(
    field: Pick<OgcNormalizedField, 'name' | 'title'>,
): string {
    return field.title?.trim() || field.name;
}

export function optionDisplayLabel(option: string | number | boolean): string {
    return String(option);
}

export function columnDisplayLabel(
    column: { key: string; label: string },
    language: Language,
): string {
    const number = Number(column.key) + 1;

    return column.label === `Column ${number}`
        ? translate(language, 'ogc.arrayTableColumn', { column: number })
        : column.label;
}

export function variantDisplayLabel(label: string, language: Language): string {
    return label === 'Variant' ? translate(language, 'ogc.variant') : label;
}

export function referenceDisplayLabel(reference: {
    label: string;
    href: string;
}): string {
    return `${reference.label}: ${reference.href}`;
}
