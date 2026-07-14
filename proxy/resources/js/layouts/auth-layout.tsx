import { useTranslation } from '@/hooks/use-translation';
import AuthLayoutTemplate from '@/layouts/auth/auth-simple-layout';
import type { AuthLayoutProps } from '@/types';

export default function AuthLayout({
    title = '',
    titleKey,
    description = '',
    descriptionKey,
    children,
}: AuthLayoutProps) {
    const { t } = useTranslation();
    const resolvedTitle = titleKey ? t(titleKey) : title;
    const resolvedDescription = descriptionKey
        ? t(descriptionKey)
        : description;

    return (
        <AuthLayoutTemplate
            title={resolvedTitle}
            description={resolvedDescription}
        >
            {children}
        </AuthLayoutTemplate>
    );
}
