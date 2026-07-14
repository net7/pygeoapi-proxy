import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translation';

export type BreadcrumbItem = {
    title: string;
    titleKey?: TranslationKey;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    titleKey?: TranslationKey;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
};
