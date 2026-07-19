import { Head, Link, usePoll } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    CalendarClockIcon,
    ChevronDownIcon,
    CircleAlertIcon,
    Clock3Icon,
    FileInputIcon,
    ListChecksIcon,
    PackageCheckIcon,
    ShieldCheckIcon,
    TimerIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
import JobIdentifiers from '@/components/ogc/job-identifiers';
import { JobNameEditDialog } from '@/components/ogc/job-name-edit-dialog';
import { JobNoteCard } from '@/components/ogc/job-note-card';
import JobPollingIndicator from '@/components/ogc/job-polling-indicator';
import RawPayloadBlock from '@/components/ogc/raw-payload-block';
import ResultPreview from '@/components/ogc/result-preview';
import ResultPreviewLoading from '@/components/ogc/result-preview-loading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import type { TranslationKey } from '@/lib/i18n/translation';
import {
    clampProgress,
    formatJobDate,
    isJobFailure,
    isJobTerminal,
    jobStatusStyles,
} from '@/lib/jobs';
import { hasPendingMapLayers } from '@/lib/ogc-map-layers';
import { groupProcessResults } from '@/lib/ogc-result-groups';
import { cn } from '@/lib/utils';
import { index } from '@/routes/jobs';
import type { ProcessExecutionDetail } from '@/types';

const GeoTiffMapResultPreview = lazy(
    () => import('@/components/ogc/geotiff-map-result-preview'),
);

type Translate = ReturnType<typeof useTranslation>['t'];

export default function ProcessExecutionShow({
    execution,
    pollingInterval,
}: {
    execution: ProcessExecutionDetail;
    pollingInterval: number;
}) {
    const { locale, t } = useTranslation();
    const styles = jobStatusStyles(execution.status);
    const StatusIcon = styles.icon;
    const terminalTimestamp = execution.completedAt ?? execution.failedAt;
    const terminalLabel = execution.completedAt
        ? t('jobs.completed')
        : execution.failedAt
          ? t('jobs.failed')
          : t('jobs.finished');
    const isPolling = !isJobTerminal(execution.status);
    const shouldRefreshMapLayers =
        !isPolling && hasPendingMapLayers(execution.results);
    const visualResults = groupProcessResults(
        execution.results,
        execution.outputMetadata,
    );

    return (
        <>
            <Head
                title={t('jobs.documentTitle', {
                    jobId: execution.displayName,
                })}
            />
            <MapLayerRefreshPoller
                active={shouldRefreshMapLayers}
                interval={pollingInterval}
            />

            <div className="flex min-w-0 flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="w-fit"
                        >
                            <Link href={index()}>
                                <ArrowLeftIcon data-icon="inline-start" />
                                {t('jobs.backToJobs')}
                            </Link>
                        </Button>

                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="min-w-0 text-2xl font-semibold">
                                    {execution.displayName}
                                </h1>
                                <JobNameEditDialog execution={execution} />
                                <Badge
                                    variant="outline"
                                    aria-label={t('common.status')}
                                    className={cn(
                                        'shrink-0 tracking-wide',
                                        styles.badgeClassName,
                                    )}
                                >
                                    <StatusIcon data-icon="inline-start" />
                                    {jobStatusLabel(execution.status, t)}
                                </Badge>
                            </div>
                            <HeaderMetadata
                                execution={execution}
                                locale={locale}
                                progressClassName={styles.progressClassName}
                                t={t}
                                terminalLabel={terminalLabel}
                                terminalTimestamp={terminalTimestamp}
                            />
                            <p className="text-sm text-muted-foreground">
                                {execution.processTitle ?? execution.processId}{' '}
                                <span className="text-muted-foreground/70">
                                    ({execution.processId}
                                    {execution.processVersion
                                        ? ` v${execution.processVersion}`
                                        : ''}
                                    )
                                </span>
                            </p>
                            <JobPollingIndicator
                                active={isPolling}
                                activeLabel={t('jobs.pollingShowActive')}
                                inactiveLabel={t('jobs.pollingShowInactive')}
                                interval={pollingInterval}
                                only={['execution', 'pollingInterval']}
                            />
                            <JobIdentifiers
                                id={execution.id}
                                remoteJobId={execution.remoteJobId}
                                inline
                            />
                        </div>
                    </div>

                    <div className="flex justify-end lg:pt-9">
                        <DeleteJobButton
                            execution={execution}
                            className="w-full sm:w-auto"
                        />
                    </div>
                </div>

                <JobNoteCard execution={execution} />

                {execution.requestPayload !== undefined ? (
                    <DetailSection
                        icon={FileInputIcon}
                        title={t('jobs.inputs')}
                        description={t('jobs.inputsDescription')}
                        defaultOpen={false}
                        badge={
                            <Badge
                                variant="destructive"
                                className="h-5 shrink-0 px-1.5 text-[10px] uppercase"
                            >
                                <ShieldCheckIcon data-icon="inline-start" />
                                {t('jobs.adminOnlySection')}
                            </Badge>
                        }
                    >
                        <RawPayloadBlock
                            title={t('jobs.inputs')}
                            data={execution.requestPayload}
                            kind="json"
                        />
                    </DetailSection>
                ) : null}

                <DetailSection
                    icon={PackageCheckIcon}
                    title={t('ogc.outputs')}
                    description={t(
                        visualResults.length === 1
                            ? 'ogc.outputCountOne'
                            : 'ogc.outputCountMany',
                        { count: visualResults.length },
                    )}
                    badge={
                        <Badge variant="secondary" className="shrink-0">
                            <PackageCheckIcon data-icon="inline-start" />
                            {visualResults.length}
                        </Badge>
                    }
                >
                    {isPolling ? (
                        <OutputPendingNotice
                            title={t('jobs.outputPendingTitle')}
                            description={t('jobs.outputPendingDescription')}
                        />
                    ) : execution.results.length > 0 ? (
                        <div className="flex min-w-0 flex-col gap-3">
                            {visualResults.map((item) =>
                                item.kind === 'geotiff-map' ? (
                                    <Suspense
                                        key={`map-${item.outputId}`}
                                        fallback={
                                            <ResultPreviewLoading className="min-h-[30rem]" />
                                        }
                                    >
                                        <GeoTiffMapResultPreview
                                            executionId={execution.id}
                                            title={item.title}
                                            description={item.description}
                                            geotiff={item.geotiff}
                                            sld={item.sld}
                                        />
                                    </Suspense>
                                ) : (
                                    <ResultPreview
                                        key={item.result.id}
                                        executionId={execution.id}
                                        result={item.result}
                                    />
                                ),
                            )}
                        </div>
                    ) : isJobFailure(execution.status) ? (
                        <ProcessFailureNotice
                            title={t('jobs.failureTitle')}
                            description={
                                execution.message ?? t('jobs.noJobMessage')
                            }
                        />
                    ) : (
                        <AlertResultsEmpty
                            title={t('jobs.noResultsTitle')}
                            description={t('jobs.noResultsDescription')}
                        />
                    )}
                </DetailSection>
            </div>
        </>
    );
}

function MapLayerRefreshPoller({
    active,
    interval,
}: {
    active: boolean;
    interval: number;
}) {
    if (!active) {
        return null;
    }

    return <ActiveMapLayerRefreshPoller interval={interval} />;
}

function ActiveMapLayerRefreshPoller({ interval }: { interval: number }) {
    usePoll(
        interval,
        {
            only: ['execution', 'pollingInterval'],
        },
        {
            mode: 'rest',
        },
    );

    return null;
}

ProcessExecutionShow.layout = {
    breadcrumbs: [
        {
            title: 'My Jobs',
            titleKey: 'jobs.title',
            href: index(),
        },
    ],
};

function jobStatusLabel(status: string, t: Translate): string {
    const key = {
        accepted: 'jobs.status.accepted',
        failed: 'jobs.status.failed',
        remote_missing: 'jobs.status.remoteMissing',
        running: 'jobs.status.running',
        submission_failed: 'jobs.status.submissionFailed',
        submitting: 'jobs.status.submitting',
        successful: 'jobs.status.successful',
    }[status] as TranslationKey | undefined;

    return key ? t(key) : status.replaceAll('_', ' ').toUpperCase();
}

function DetailSection({
    icon: Icon,
    title,
    description,
    badge,
    defaultOpen,
    children,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    badge?: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const header = (
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
                <CardTitleWithIcon
                    titleIcon={Icon}
                    collapsible={defaultOpen !== undefined}
                >
                    {title}
                </CardTitleWithIcon>
                <CardDescription>{description}</CardDescription>
            </div>
            {badge}
        </CardHeader>
    );

    if (defaultOpen !== undefined) {
        return (
            <Collapsible defaultOpen={defaultOpen} asChild>
                <Card className="min-w-0 shadow-sm dark:border-border/70 dark:bg-card/95">
                    {header}
                    <CollapsibleContent>
                        <CardContent className="flex min-w-0 flex-col gap-4">
                            {children}
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        );
    }

    return (
        <Card className="min-w-0 shadow-sm dark:border-border/70 dark:bg-card/95">
            {header}
            <CardContent className="flex min-w-0 flex-col gap-4">
                {children}
            </CardContent>
        </Card>
    );
}

function CardTitleWithIcon({
    titleIcon: Icon,
    collapsible = false,
    children,
}: {
    titleIcon: LucideIcon;
    collapsible?: boolean;
    children: ReactNode;
}) {
    const title = (
        <>
            <span className="min-w-0 truncate">{children}</span>
            {collapsible ? (
                <ChevronDownIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform"
                />
            ) : null}
        </>
    );

    return (
        <CardTitle className="flex min-w-0 items-center gap-2">
            <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
            />
            {collapsible ? (
                <CollapsibleTrigger className="flex min-w-0 items-center gap-1 rounded-sm text-left ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]>svg]:rotate-180">
                    {title}
                </CollapsibleTrigger>
            ) : (
                title
            )}
        </CardTitle>
    );
}

function ProcessFailureNotice({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <Alert
            variant="destructive"
            className="border-destructive-emphasis bg-destructive/10 text-destructive-emphasis *:data-[slot=alert-description]:text-destructive-emphasis/80"
        >
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="break-words whitespace-pre-wrap">
                {description}
            </AlertDescription>
        </Alert>
    );
}

function AlertResultsEmpty({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-md border bg-muted/40 p-4 dark:bg-muted/30">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function OutputPendingNotice({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <Alert className="min-h-28 content-center">
            <Spinner />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </Alert>
    );
}

function HeaderMetadata({
    execution,
    locale,
    progressClassName,
    t,
    terminalLabel,
    terminalTimestamp,
}: {
    execution: ProcessExecutionDetail;
    locale: string;
    progressClassName: string;
    t: Translate;
    terminalLabel: string;
    terminalTimestamp: string | null | undefined;
}) {
    return (
        <div className="max-w-full overflow-x-auto">
            <div className="flex w-max flex-nowrap items-center gap-x-4 border-y border-border/60 py-2">
                <HeaderProgressItem
                    label={t('jobs.progress')}
                    progress={execution.progress}
                    progressClassName={progressClassName}
                />
                <HeaderMetadataItem
                    icon={ListChecksIcon}
                    label={t('jobs.results')}
                    value={String(execution.results.length)}
                />
                <HeaderMetadataItem
                    icon={CalendarClockIcon}
                    label={t('jobs.created')}
                    value={formatJobDate(
                        execution.createdAt,
                        locale,
                        t('common.notAvailable'),
                    )}
                />
                <HeaderMetadataItem
                    icon={Clock3Icon}
                    label={t('jobs.submitted')}
                    value={formatJobDate(
                        execution.submittedAt,
                        locale,
                        t('common.notAvailable'),
                    )}
                />
                <HeaderMetadataItem
                    icon={TimerIcon}
                    label={terminalLabel}
                    value={formatJobDate(
                        terminalTimestamp,
                        locale,
                        t('common.notAvailable'),
                    )}
                />
            </div>
        </div>
    );
}

function HeaderMetadataItem({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <span className="inline-flex shrink-0 items-center gap-2 border-l border-border/60 pl-4 text-xs whitespace-nowrap first:border-l-0 first:pl-0">
            <Icon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground/80"
            />
            <span className="shrink-0 font-medium text-muted-foreground">
                {label}
            </span>
            <HeaderMetadataValue value={value} />
        </span>
    );
}

function HeaderProgressItem({
    label,
    progress,
    progressClassName,
}: {
    label: string;
    progress: number;
    progressClassName: string;
}) {
    const value = clampProgress(progress);

    return (
        <span className="inline-flex shrink-0 items-center gap-2 border-l border-border/60 pl-4 text-xs whitespace-nowrap first:border-l-0 first:pl-0">
            <TimerIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground/80"
            />
            <span className="shrink-0 font-medium text-muted-foreground">
                {label}
            </span>
            <HeaderMetadataProgress
                value={value}
                progressClassName={progressClassName}
            />
            <HeaderMetadataValue value={`${value}%`} />
        </span>
    );
}

function HeaderMetadataValue({ value }: { value: string }) {
    return (
        <span className="font-semibold whitespace-nowrap text-foreground tabular-nums">
            {value}
        </span>
    );
}

function HeaderMetadataProgress({
    value,
    progressClassName,
}: {
    value: number;
    progressClassName: string;
}) {
    return (
        <div
            className="h-1.5 w-16 overflow-hidden rounded-full bg-muted dark:bg-background/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
        >
            <div
                className={cn(
                    'h-full rounded-full transition-[width]',
                    progressClassName,
                )}
                style={{ width: `${value}%` }}
            />
        </div>
    );
}
