import { LanguagesIcon } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { languageMetadata, supportedLanguages } from '@/lib/i18n/languages';
import type { Language } from '@/lib/i18n/languages';
import { cn } from '@/lib/utils';

export default function LanguageTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { language, updateLanguage } = useLanguage();

    return (
        <div
            className={cn(
                'inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800',
                className,
            )}
            {...props}
        >
            {supportedLanguages.map((value: Language) => (
                <button
                    key={value}
                    onClick={() => updateLanguage(value)}
                    className={cn(
                        'flex cursor-pointer items-center rounded-md px-3.5 py-1.5 transition-colors',
                        language === value
                            ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                            : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                    )}
                >
                    <LanguagesIcon className="-ml-1 h-4 w-4" />
                    <span className="ml-1.5 text-sm">
                        {languageMetadata[value].label}
                    </span>
                </button>
            ))}
        </div>
    );
}
