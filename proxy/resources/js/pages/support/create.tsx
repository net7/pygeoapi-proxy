import { Head, usePage } from '@inertiajs/react';
import { SupportForm } from '@/components/support-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/use-translation';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import { create } from '@/routes/support';

export default function SupportCreate({
    available,
    initialEmail,
}: {
    available: boolean;
    initialEmail: string;
}) {
    const { auth, support } = usePage().props;
    const { t } = useTranslation();
    const content = available ? (
        <SupportForm initialEmail={initialEmail} limits={support} />
    ) : (
        <Alert>
            <AlertDescription>{t('support.unavailable')}</AlertDescription>
        </Alert>
    );

    return (
        <>
            <Head title={t('support.title')} />
            {auth.user ? (
                <AppLayout
                    breadcrumbs={[
                        { title: t('support.title'), href: create().url },
                    ]}
                >
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
                        <header className="flex flex-col gap-2">
                            <h1 className="text-2xl font-semibold">
                                {t('support.title')}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {t('support.intro')}
                            </p>
                        </header>
                        {content}
                    </div>
                </AppLayout>
            ) : (
                <AuthLayout
                    title={t('support.title')}
                    description={t('support.intro')}
                >
                    {content}
                </AuthLayout>
            )}
        </>
    );
}
