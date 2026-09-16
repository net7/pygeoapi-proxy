import { Head, Link } from '@inertiajs/react';
import { ArrowRightIcon, CpuIcon } from 'lucide-react';

import CacheWarmupPoller from '@/components/ogc/cache-warmup-poller';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { formatJobDate } from '@/lib/jobs';
import { index, show } from '@/routes/processes';
import type { OgcCacheStatus, OgcProcessSummary } from '@/types';

export default function ProcessIndex({
    catalogStatus = 'ready',
    catalogLastUpdatedAt = null,
    processes,
}: {
    catalogStatus?: OgcCacheStatus;
    catalogLastUpdatedAt?: string | null;
    processes: OgcProcessSummary[];
}) {
    const { t, locale } = useTranslation();
    const isWarming = catalogStatus === 'warming';

    return (
        <>
            <Head title={t('ogc.processesTitle')} />

            <div className="flex flex-col gap-7 p-4">
                <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1>{t('ogc.processesTitle')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('ogc.processesDescription')}
                        </p>
                        {catalogLastUpdatedAt ? (
                            <p className="text-xs text-muted-foreground">
                                {t('ogc.servicesLastUpdatedAt', {
                                    date: formatJobDate(
                                        catalogLastUpdatedAt,
                                        locale,
                                        t('common.notAvailable'),
                                    ),
                                })}
                            </p>
                        ) : null}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                        {t(
                            processes.length === 1
                                ? 'ogc.processCountOne'
                                : 'ogc.processCountMany',
                            { count: processes.length },
                        )}
                    </Badge>
                </div>

                {isWarming ? (
                    <>
                        <CacheWarmupPoller
                            interval={3000}
                            only={[
                                'catalogStatus',
                                'catalogLastUpdatedAt',
                                'processes',
                            ]}
                        />
                        <Alert>
                            <Spinner className="text-primary" />
                            <AlertTitle>
                                {t('ogc.servicePreparingTitle')}
                            </AlertTitle>
                            <AlertDescription>
                                {t('ogc.servicePreparingDescription')}
                            </AlertDescription>
                        </Alert>
                    </>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {processes.map((process) => {
                            const description =
                                process.description?.trim() ||
                                t('ogc.noDescription');

                            return (
                                <Link
                                    key={process.id}
                                    href={show(process.id)}
                                    aria-label={`${t('ogc.openProcess')}: ${process.title ?? process.id}`}
                                    className="process-card group block h-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <Card className="h-full overflow-hidden">
                                        <CardHeader className="gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="process-card-icon">
                                                    <CpuIcon
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                                        <CardTitle className="min-w-0 text-lg leading-tight break-words">
                                                            {process.title ??
                                                                process.id}
                                                        </CardTitle>
                                                        {process.version ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="shrink-0"
                                                            >
                                                                {`v${process.version}`}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <CardDescription className="truncate font-mono text-xs">
                                                        {process.id}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex flex-1 flex-col gap-5">
                                            <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">
                                                {description}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="mt-auto justify-between gap-3">
                                            <span className="text-sm font-medium text-primary underline-offset-4 group-hover:underline group-focus-visible:underline">
                                                {t('ogc.openProcess')}
                                            </span>
                                            <ArrowRightIcon
                                                aria-hidden="true"
                                                data-icon="inline-end"
                                                className="size-4 shrink-0 text-primary"
                                            />
                                        </CardFooter>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

ProcessIndex.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            titleKey: 'ogc.processesTitle',
            href: index(),
        },
    ],
};
