import { defaultLanguage, normalizeLanguage } from './languages';
import type { Language } from './languages';
import { messages } from './messages';
import type { Messages } from './messages';

type LeafKeys<T, Prefix extends string = ''> = {
    [Key in keyof T & string]: T[Key] extends string
        ? `${Prefix}${Key}`
        : T[Key] extends Record<string, unknown>
          ? LeafKeys<T[Key], `${Prefix}${Key}.`>
          : never;
}[keyof T & string];

export type TranslationKey = LeafKeys<Messages>;
export type TranslationValues = Record<string, string | number>;

export function translate(
    language: Language,
    key: TranslationKey,
    values: TranslationValues = {},
): string {
    const message = lookupMessage(normalizeLanguage(language), key);
    const fallback = message ?? lookupMessage(defaultLanguage, key) ?? key;

    return interpolate(fallback, values);
}

function lookupMessage(language: Language, key: TranslationKey): string | null {
    const segments = key.split('.');
    let current: unknown = messages[language];

    for (const segment of segments) {
        if (
            typeof current !== 'object' ||
            current === null ||
            !(segment in current)
        ) {
            return null;
        }

        current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' ? current : null;
}

function interpolate(message: string, values: TranslationValues): string {
    return message.replace(/\{([^}]+)\}/g, (match, key: string) => {
        const value = values[key];

        return value === undefined ? match : String(value);
    });
}
