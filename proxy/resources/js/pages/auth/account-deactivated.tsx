import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, ShieldAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { login } from '@/routes';

export default function AccountDeactivated() {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('auth.accountDeactivated.title')} />

            <div className="flex flex-col gap-6">
                <Alert>
                    <ShieldAlertIcon />
                    <AlertTitle>
                        {t('auth.accountDeactivated.noticeTitle')}
                    </AlertTitle>
                    <AlertDescription>
                        {t('auth.accountDeactivated.noticeDescription')}
                    </AlertDescription>
                </Alert>

                <Button asChild className="w-full">
                    <Link href={login()}>
                        <ArrowLeftIcon data-icon="inline-start" />
                        {t('auth.accountDeactivated.returnToLogin')}
                    </Link>
                </Button>
            </div>
        </>
    );
}

AccountDeactivated.layout = {
    title: 'Account disattivato',
    titleKey: 'auth.accountDeactivated.title',
    description: 'Non puoi accedere con questo account.',
    descriptionKey: 'auth.accountDeactivated.description',
};
