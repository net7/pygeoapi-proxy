import { Head } from '@inertiajs/react';

import CacheWarmupPoller from '@/components/ogc/cache-warmup-poller';
import DynamicProcessForm from '@/components/ogc/dynamic-process-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { index } from '@/routes/processes';
import type { OgcCacheStatus, OgcFormSchema } from '@/types';

export default function ProcessShow({
    formSchema,
    processStatus = 'ready',
}: {
    formSchema: OgcFormSchema | null;
    processStatus?: OgcCacheStatus;
}) {
    const { t } = useTranslation();

    if (processStatus === 'warming' || formSchema === null) {
        return (
            <>
                <Head title={t('ogc.processPreparing')} />
                <CacheWarmupPoller
                    interval={3000}
                    only={['process', 'processStatus', 'formSchema']}
                />

                <div className="flex min-w-0 flex-col gap-4 p-4">
                    <Alert>
                        <Spinner className="text-primary" />
                        <AlertTitle>
                            {t('ogc.processPreparingTitle')}
                        </AlertTitle>
                        <AlertDescription>
                            {t('ogc.processPreparingDescription')}
                        </AlertDescription>
                    </Alert>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={formSchema.title} />

            <div className="flex min-w-0 flex-col gap-4 p-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-2xl font-semibold">
                        {formSchema.title}
                    </h1>
                    <p className="text-sm break-words text-muted-foreground">
                        {formSchema.description}
                    </p>
                </div>

                <DynamicProcessForm schema={formSchema} />
            </div>
        </>
    );
}

ProcessShow.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            titleKey: 'ogc.processesTitle',
            href: index(),
        },
    ],
};
