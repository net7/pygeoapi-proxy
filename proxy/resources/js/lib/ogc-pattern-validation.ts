import type { TranslationKey, TranslationValues } from '@/lib/i18n/translation';

type OgcPatternTranslator = (
    key: TranslationKey,
    values?: TranslationValues,
) => string;

export function ogcPatternValidationMessage(
    pattern: string | null,
    translate: OgcPatternTranslator,
): string {
    if (!pattern) {
        return translate('ogc.validationPattern');
    }

    if (isSolwcadDecimalPattern(pattern)) {
        return translate('ogc.validationPatternExamples');
    }

    return translate('ogc.validationPatternExpression', { pattern });
}

function isSolwcadDecimalPattern(pattern: string): boolean {
    return (
        pattern.includes('(?:[0-9]+\\.|[0-9]*\\.[0-9]+)') &&
        pattern.includes('[Dd]')
    );
}
