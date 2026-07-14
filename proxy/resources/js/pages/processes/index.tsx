import { Head, Link } from '@inertiajs/react';
import { ArrowRightIcon, CpuIcon, PlayCircleIcon } from 'lucide-react';

import CacheWarmupPoller from '@/components/ogc/cache-warmup-poller';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">
                            {t('ogc.processesTitle')}
                        </h1>
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
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                        {processes.map((process) => {
                            const description =
                                process.description?.trim() ||
                                t('ogc.noDescription');

                            return (
                                <article
                                    key={process.id}
                                    className="group h-full"
                                >
                                    <Card className="h-full overflow-hidden transition-colors group-hover:border-primary/40 group-hover:bg-accent/20">
                                        <CardHeader className="gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                    <CpuIcon
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                                        <CardTitle className="truncate text-base leading-tight">
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
                                            <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
                                                {description}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="mt-auto px-6 pt-0">
                                            <Button
                                                asChild
                                                className="w-full justify-between"
                                            >
                                                <Link href={show(process.id)}>
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <PlayCircleIcon data-icon="inline-start" />
                                                        <span className="truncate">
                                                            {t(
                                                                'ogc.openProcess',
                                                            )}
                                                        </span>
                                                    </span>
                                                    <ArrowRightIcon data-icon="inline-end" />
                                                </Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </article>
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
