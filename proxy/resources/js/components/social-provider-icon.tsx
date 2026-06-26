import type { IconBaseProps, IconType } from 'react-icons';
import { FaUser } from 'react-icons/fa';
import { SiGoogle, SiOpenid, SiOrcid } from 'react-icons/si';

import { cn } from '@/lib/utils';

export type SocialProviderStyle = {
    badgeClassName: string;
    icon: IconType;
    iconClassName: string;
};

const providerStyles: Record<string, SocialProviderStyle> = {
    google: {
        badgeClassName:
            'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/70 dark:bg-sky-500/15 dark:text-sky-100',
        icon: SiGoogle,
        iconClassName: 'text-[#4285f4]',
    },
    orcid: {
        badgeClassName:
            'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-emerald-100',
        icon: SiOrcid,
        iconClassName: 'text-[#a6ce39]',
    },
};

const defaultProviderStyle: SocialProviderStyle = {
    badgeClassName:
        'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/70 dark:bg-cyan-500/15 dark:text-cyan-100',
    icon: SiOpenid,
    iconClassName: 'text-cyan-700 dark:text-cyan-200',
};

const localProviderStyle: SocialProviderStyle = {
    badgeClassName:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/70 dark:bg-slate-500/15 dark:text-slate-100',
    icon: FaUser,
    iconClassName: 'text-slate-600 dark:text-slate-200',
};

export function getSocialProviderStyle(
    provider?: string | null,
): SocialProviderStyle {
    if (!provider) {
        return localProviderStyle;
    }

    return providerStyles[provider.toLowerCase()] ?? defaultProviderStyle;
}

export function SocialProviderIcon({
    provider,
    className,
    ...props
}: IconBaseProps & { provider?: string | null }) {
    const style = getSocialProviderStyle(provider);
    const Icon = style.icon;

    return (
        <Icon
            aria-hidden="true"
            className={cn('size-4', style.iconClassName, className)}
            {...props}
        />
    );
}
