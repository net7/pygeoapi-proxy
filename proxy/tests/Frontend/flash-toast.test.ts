import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { translate } from '../../resources/js/lib/i18n/translation';

describe('flash toast localization', () => {
    test('uses translation keys for default flash toast descriptions', () => {
        expect(translate('it', 'toast.defaultSuccess')).toBe(
            'La modifica è stata salvata.',
        );
        expect(translate('en', 'toast.defaultSuccess')).toBe(
            'The change has been saved.',
        );

        const source = readFileSync(
            'resources/js/hooks/use-flash-toast.ts',
            'utf8',
        );

        expect(source).toContain('useTranslation');
        expect(source).toContain("t('toast.defaultSuccess')");
        expect(source).not.toContain('The request could not be completed.');
    });
});
