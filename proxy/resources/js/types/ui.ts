import type { ReactNode } from 'react';
import type { TranslationKey } from '@/lib/i18n/translation';
import type { BreadcrumbItem } from '@/types/navigation';

export type AppLayoutProps = {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
};

export type AppVariant = 'header' | 'sidebar';

export type FlashToastDetail = {
    label: string;
    value: string;
};

export type FlashToast = {
    type: 'success' | 'info' | 'warning' | 'error';
    title?: string;
    message: string;
    description?: string;
    details?: FlashToastDetail[];
    icon?: false;
    note?: string;
};

export type AuthLayoutProps = {
    children?: ReactNode;
    name?: string;
    title?: string;
    titleKey?: TranslationKey;
    description?: string;
    descriptionKey?: TranslationKey;
};
