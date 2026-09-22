import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, FolderOpenIcon, ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import AuthSimpleLayout from '@/layouts/auth/auth-simple-layout';
import { login } from '@/routes';
import { index as jobsIndex } from '@/routes/jobs';
import { index as processesIndex } from '@/routes/processes';

export default function NotFound({
    authenticated = false,
}: {
    authenticated?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={`${t('errors.notFound.title')} (404)`} />

            <AuthSimpleLayout
                statusCode={404}
                title={t('errors.notFound.title')}
                description={t('errors.notFound.description')}
            >
                <nav className="flex flex-col gap-3">
                    {authenticated ? (
                        <>
                            <Button asChild>
                                <Link href={processesIndex()}>
                                    <FolderOpenIcon data-icon="inline-start" />
                                    {t('errors.notFound.catalog')}
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={jobsIndex()}>
                                    <ListIcon data-icon="inline-start" />
                                    {t('errors.notFound.jobs')}
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <Button asChild>
                            <Link href={login()}>
                                <ArrowLeftIcon data-icon="inline-start" />
                                {t('errors.notFound.login')}
                            </Link>
                        </Button>
                    )}
                </nav>
            </AuthSimpleLayout>
        </>
    );
}
