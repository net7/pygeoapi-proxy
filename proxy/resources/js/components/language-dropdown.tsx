import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import {
    isLanguage,
    languageMetadata,
    supportedLanguages,
} from '@/lib/i18n/languages';
import { cn } from '@/lib/utils';

export default function LanguageDropdown({
    className,
}: {
    className?: string;
}) {
    const { language, updateLanguage, t } = useTranslation();
    const selectedLanguage = languageMetadata[language];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    aria-label={`${t('settings.appearance.languageTitle')}: ${selectedLanguage.label}`}
                    className={cn('h-11 shrink-0 md:h-9', className)}
                >
                    <span aria-hidden="true">{selectedLanguage.flag}</span>
                    <span>{language.toUpperCase()}</span>
                    <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                    value={language}
                    onValueChange={(value) => {
                        if (isLanguage(value)) {
                            updateLanguage(value);
                        }
                    }}
                    aria-label={t('settings.appearance.languageTitle')}
                >
                    {supportedLanguages.map((value) => (
                        <DropdownMenuRadioItem
                            key={value}
                            value={value}
                            lang={value}
                            className="min-h-11 md:min-h-9"
                        >
                            <span aria-hidden="true">
                                {languageMetadata[value].flag}
                            </span>
                            {languageMetadata[value].label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
