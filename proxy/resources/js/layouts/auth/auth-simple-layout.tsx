import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import AuthLandscape from '@/components/auth-landscape';
import { useTranslation } from '@/hooks/use-translation';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
    statusCode,
}: AuthLayoutProps & { statusCode?: 403 | 404 }) {
    const { t } = useTranslation();

    return (
        <div className="auth-canvas">
            <div data-page-content className="auth-shell">
                <aside className="auth-intro">
                    <Link href={home()} className="auth-logo">
                        <AppLogoIcon className="h-auto w-full" />
                    </Link>
                    <div className="auth-identity">
                        <p className="auth-project-name">Geo-INQUIRE</p>
                        <p className="auth-project-description">
                            {t('auth.platformDescription')}
                        </p>
                    </div>
                    <AuthLandscape />
                </aside>
                <main className="auth-panel" data-auth-status={statusCode}>
                    <header className="flex flex-col gap-3">
                        {statusCode && (
                            <p className="auth-status-code" aria-hidden="true">
                                {statusCode}
                            </p>
                        )}
                        <h1 className="auth-title">{title}</h1>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    </header>
                    {children}
                </main>
            </div>
        </div>
    );
}
