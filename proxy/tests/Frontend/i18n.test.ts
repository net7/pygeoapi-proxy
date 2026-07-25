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
        expect(translate('it', 'jobs.pagination', { page: 2, pages: 8 })).toBe(
            'Pagina 2 di 8',
        );
        expect(translate('en', 'jobs.pagination', { page: 2, pages: 8 })).toBe(
            'Page 2 of 8',
        );
    });

    test('translates the deactivated account page', () => {
        expect(translate('it', 'auth.accountDeactivated.title')).toBe(
            'Account disattivato',
        );
        expect(translate('en', 'auth.accountDeactivated.title')).toBe(
            'Account deactivated',
        );
        expect(
            translate('it', 'auth.accountDeactivated.noticeDescription'),
        ).toBe(
            'Contatta un amministratore e chiedi di riattivare il tuo account prima di riprovare.',
        );
        expect(
            translate('en', 'auth.accountDeactivated.noticeDescription'),
        ).toBe(
            'Contact an administrator and ask them to reactivate your account before trying again.',
        );
        expect(translate('it', 'auth.accountDeactivated.returnToLogin')).toBe(
            'Torna alla pagina di accesso',
        );
        expect(translate('en', 'auth.accountDeactivated.returnToLogin')).toBe(
            'Back to sign in',
        );
    });

    test('translates process output selection controls', () => {
        expect(translate('it', 'ogc.outputFormat')).toBe('Formato output');
        expect(translate('en', 'ogc.outputFormat')).toBe('Output format');
        expect(translate('it', 'ogc.image')).toBe('Immagine');
        expect(translate('en', 'ogc.image')).toBe('Image');
        expect(translate('it', 'ogc.noOutputsSelected')).toBe(
            'Nessun output verrà richiesto',
        );
        expect(translate('en', 'ogc.noOutputsSelected')).toBe(
            'No outputs will be requested',
        );
    });

    test('translates corrected OGC field status', () => {
        expect(translate('it', 'ogc.fieldValid')).toBe('Campo valido');
        expect(translate('en', 'ogc.fieldValid')).toBe('Field is valid');
    });

    test('translates responsive array table controls', () => {
        expect(translate('it', 'ogc.arrayTableRow', { row: 2 })).toBe('Riga 2');
        expect(translate('en', 'ogc.arrayTableRow', { row: 2 })).toBe('Row 2');
        expect(translate('it', 'ogc.arrayTableScrollHint')).toBe(
            'Scorri orizzontalmente per vedere tutte le colonne.',
        );
        expect(translate('en', 'ogc.arrayTableScrollHint')).toBe(
            'Scroll horizontally to view all columns.',
        );
    });

    test('translates the OGC validation toast', () => {
        expect(translate('it', 'ogc.checkProcessData')).toBe(
            'Controlla i dati del processo',
        );
        expect(translate('en', 'ogc.checkProcessData')).toBe(
            'Check the process data',
        );
        expect(translate('it', 'ogc.someValuesNeedAttention')).toBe(
            'Alcuni valori richiedono attenzione prima di eseguire il processo.',
        );
        expect(translate('en', 'ogc.someValuesNeedAttention')).toBe(
            'Some values need attention before the process can run.',
        );
        expect(translate('it', 'toast.close')).toBe('Chiudi notifica');
        expect(translate('en', 'toast.close')).toBe('Close notification');
        expect(translate('it', 'toast.notifications')).toBe('Notifiche');
        expect(translate('en', 'toast.notifications')).toBe('Notifications');
    });

    test('translates native OGC constraint messages', () => {
        expect(translate('it', 'ogc.validationRequired')).toBe(
            'Compila questo campo.',
        );
        expect(translate('en', 'ogc.validationRequired')).toBe(
            'Please fill out this field.',
        );
        expect(translate('it', 'ogc.validationMinimum', { value: 5 })).toBe(
            'Il valore deve essere maggiore o uguale a 5.',
        );
        expect(translate('en', 'ogc.validationMinimum', { value: 5 })).toBe(
            'The value must be greater than or equal to 5.',
        );
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
        expect(translate('it', 'jobs.adminOnlySection')).toBe(
            'VISIBILE SOLO AGLI ADMIN',
        );
        expect(translate('en', 'jobs.adminOnlySection')).toBe(
            'VISIBLE TO ADMINS ONLY',
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
