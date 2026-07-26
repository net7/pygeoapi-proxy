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

    test('keeps every toast type on the same icon-free layout', () => {
        const toaster = readFileSync(
            'resources/js/components/ui/sonner.tsx',
            'utf8',
        );

        for (const type of ['success', 'info', 'warning', 'error', 'loading']) {
            expect(toaster).toContain(`${type}: null`);
        }

        expect(toaster).toContain("icon: 'hidden!'");
    });
});
