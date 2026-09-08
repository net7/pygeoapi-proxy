export type Language = 'it' | 'en';

export const defaultLanguage: Language = 'en';
export const supportedLanguages = ['en', 'it'] as const;

export type LanguageMetadata = {
    readonly label: string;
    readonly locale: string;
    readonly flag: string;
};

export const languageMetadata = {
    it: { label: 'Italiano', locale: 'it-IT', flag: '🇮🇹' },
    en: { label: 'English', locale: 'en-US', flag: '🇬🇧' },
} satisfies Record<Language, LanguageMetadata>;

export function isLanguage(value: unknown): value is Language {
    return (
        typeof value === 'string' &&
        supportedLanguages.includes(value as Language)
    );
}

export function normalizeLanguage(value: unknown): Language {
    return isLanguage(value) ? value : defaultLanguage;
}

export function languageToLocale(language: Language): string {
    return languageMetadata[language].locale;
}
