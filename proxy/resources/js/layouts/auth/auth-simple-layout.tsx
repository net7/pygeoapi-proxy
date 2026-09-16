import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="auth-canvas flex min-h-svh flex-col items-center justify-center gap-6 p-5 md:p-10">
            <div data-page-content className="auth-panel w-full max-w-md">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-7">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-2 font-medium"
                        >
                            <AppLogoIcon className="h-auto w-full max-w-80" />
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="flex flex-col gap-2 text-center">
                            <h1 className="text-2xl font-semibold">{title}</h1>
                            <p className="text-center text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
