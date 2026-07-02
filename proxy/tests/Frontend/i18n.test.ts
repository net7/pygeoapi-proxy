import { describe, expect, test } from 'bun:test';

import {
    defaultLanguage,
    languageMetadata,
    languageToLocale,
    normalizeLanguage,
} from '../../resources/js/lib/i18n/languages';
import { messages } from '../../resources/js/lib/i18n/messages';
import { translate } from '../../resources/js/lib/i18n/translation';

function flattenMessages(
    value: Record<string, unknown>,
    path: string[] = [],
): Array<[string, string]> {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
        const nextPath = [...path, key];

        return typeof nestedValue === 'string'
            ? [[nextPath.join('.'), nestedValue]]
            : flattenMessages(nestedValue as Record<string, unknown>, nextPath);
    });
}

describe('i18n', () => {
    test('defaults invalid languages to italian', () => {
        expect(defaultLanguage).toBe('it');
        expect(normalizeLanguage('en')).toBe('en');
        expect(normalizeLanguage('fr')).toBe('it');
        expect(normalizeLanguage(null)).toBe('it');
    });

    test('maps language to intl locale', () => {
        expect(languageMetadata.it.label).toBe('Italiano');
        expect(languageMetadata.en.label).toBe('English');
        expect(languageToLocale('it')).toBe('it-IT');
        expect(languageToLocale('en')).toBe('en-US');
    });

    test('translates keys and interpolates values', () => {
        expect(translate('it', 'common.save')).toBe('Salva');
        expect(translate('en', 'common.save')).toBe('Save');
        expect(
            translate('it', 'jobs.pagination', { page: 2, pages: 8 }),
        ).toBe('Pagina 2 di 8');
        expect(
            translate('en', 'jobs.pagination', { page: 2, pages: 8 }),
        ).toBe('Page 2 of 8');
    });

    test('uses italian process wording for job labels', () => {
        expect(translate('it', 'navigation.myJobs')).toBe('I miei processi');
        expect(translate('it', 'admin.userJobs')).toBe('Processi');
        expect(translate('it', 'admin.viewUserJobs')).toBe('Vedi processi');
        expect(translate('it', 'jobs.jobId')).toBe('ID processo');
        expect(translate('it', 'jobs.deleteConfirm')).toBe('Elimina');
        expect(translate('it', 'jobs.deleteDescription')).toBe(
            'Questa azione rimuove il processo dalla piattaforma. L’operazione non può essere annullata.',
        );
        expect(translate('it', 'jobs.deleteDescription')).not.toContain(
            'servizio',
        );

        const italianLegacyJobNouns = flattenMessages(messages.it).filter(
            ([, value]) => /\blavor[oi]\b/i.test(value),
        );

        expect(italianLegacyJobNouns).toEqual([]);

        const italianJobLabels = flattenMessages(messages.it).filter(
            ([, value]) => /\bjobs?\b/i.test(value),
        );

        expect(italianJobLabels).toEqual([]);
    });
});
