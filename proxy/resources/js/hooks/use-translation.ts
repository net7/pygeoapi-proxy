import { languageToLocale } from '@/lib/i18n/languages';
import { translate } from '@/lib/i18n/translation';
import type { TranslationKey, TranslationValues } from '@/lib/i18n/translation';
import { useLanguage } from './use-language';

export function useTranslation() {
    const { language, updateLanguage } = useLanguage();

    return {
        language,
        locale: languageToLocale(language),
        updateLanguage,
        t: (key: TranslationKey, values?: TranslationValues): string =>
            translate(language, key, values),
    } as const;
}
