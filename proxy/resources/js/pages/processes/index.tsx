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
import { index, show } from '@/routes/processes';
import type { OgcCacheStatus, OgcProcessSummary } from '@/types';

export default function ProcessIndex({
    catalogStatus = 'ready',
    processes,
}: {
    catalogStatus?: OgcCacheStatus;
    processes: OgcProcessSummary[];
}) {
    const isWarming = catalogStatus === 'warming';

    return (
        <>
            <Head title="Processes" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">Processes</h1>
                        <p className="text-sm text-muted-foreground">
                            Available OGC API processes from Geo-INQUIRE.
                        </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                        {processes.length}{' '}
                        {processes.length === 1 ? 'process' : 'processes'}
                    </Badge>
                </div>

                {isWarming ? (
                    <>
                        <CacheWarmupPoller
                            interval={3000}
                            only={['catalogStatus', 'processes']}
                        />
                        <Alert>
                            <Spinner className="text-primary" />
                            <AlertTitle>
                                Service catalog is being prepared
                            </AlertTitle>
                            <AlertDescription>
                                The process list will appear when the background
                                warm-up finishes.
                            </AlertDescription>
                        </Alert>
                    </>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                        {processes.map((process) => {
                            const description =
                                process.description?.trim() ||
                                'No description provided.';

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
                                            <div className="flex flex-col gap-4">
                                                <ProcessMetadataSection
                                                    label="Job controls"
                                                    values={
                                                        process.jobControlOptions
                                                    }
                                                    emptyLabel="Not advertised"
                                                />
                                                <ProcessMetadataSection
                                                    label="Output modes"
                                                    values={
                                                        process.outputTransmission
                                                    }
                                                    emptyLabel="Default response"
                                                />
                                            </div>
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
                                                            Open process
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

function ProcessMetadataSection({
    emptyLabel,
    label,
    values,
}: {
    emptyLabel: string;
    label: string;
    values?: string[];
}) {
    const visibleValues = values?.filter(Boolean) ?? [];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium">
                <span>{label}</span>
                <span className="text-muted-foreground">
                    {visibleValues.length}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {visibleValues.length > 0 ? (
                    visibleValues.map((value) => (
                        <Badge key={value} variant="secondary">
                            {value}
                        </Badge>
                    ))
                ) : (
                    <Badge variant="outline">{emptyLabel}</Badge>
                )}
            </div>
        </div>
    );
}

ProcessIndex.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            href: index(),
        },
    ],
};
