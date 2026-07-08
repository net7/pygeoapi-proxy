import { Head, Link } from '@inertiajs/react';
import {
    ActivityIcon,
    ArrowLeftIcon,
    CalendarClockIcon,
    Clock3Icon,
    FileInputIcon,
    HashIcon,
    ListChecksIcon,
    PackageCheckIcon,
    ShieldCheckIcon,
    TimerIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
import GeoTiffMapResultPreview from '@/components/ogc/geotiff-map-result-preview';
import JobIdentifiers from '@/components/ogc/job-identifiers';
import { JobNameEditDialog } from '@/components/ogc/job-name-edit-dialog';
import { JobNoteCard } from '@/components/ogc/job-note-card';
import JobPollingIndicator from '@/components/ogc/job-polling-indicator';
import ResultPreview from '@/components/ogc/result-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import type { TranslationKey } from '@/lib/i18n/translation';
import {
    clampProgress,
    formatJobDate,
    isJobTerminal,
    jobStatusStyles,
} from '@/lib/jobs';
import { groupProcessResults } from '@/lib/ogc-result-groups';
import { cn } from '@/lib/utils';
import { index } from '@/routes/jobs';
import type { ProcessExecutionDetail } from '@/types';

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
    const visualResults = groupProcessResults(execution.results);

    return (
        <>
            <Head
                title={t('jobs.documentTitle', {
                    jobId: execution.displayName,
                })}
            />

            <div className="flex min-w-0 flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-col gap-3">
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
                                    className={cn(
                                        'shrink-0 tracking-wide',
                                        styles.badgeClassName,
                                    )}
                                >
                                    <StatusIcon data-icon="inline-start" />
                                    {jobStatusLabel(execution.status, t)}
                                </Badge>
                            </div>
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

                    <div className="flex flex-col gap-3 lg:w-[32rem]">
                        <div className="flex justify-end">
                            <DeleteJobButton
                                execution={execution}
                                className="w-full sm:w-auto"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <JobMetric
                                icon={HashIcon}
                                label={t('jobs.local')}
                                value={`#${execution.id}`}
                            />
                            <JobMetric
                                icon={ListChecksIcon}
                                label={t('jobs.results')}
                                value={String(execution.results.length)}
                            />
                            <JobMetric
                                icon={TimerIcon}
                                label={t('jobs.progress')}
                                value={`${execution.progress}%`}
                            />
                        </div>
                    </div>
                </div>

                <Card
                    className={cn(
                        'w-full min-w-0 border-l-4 py-3 shadow-sm',
                        styles.cardClassName,
                    )}
                >
                    <CardContent className="flex min-w-0 flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitleWithIcon titleIcon={ActivityIcon}>
                                {t('jobs.jobSummary')}
                            </CardTitleWithIcon>
                        </div>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Badge
                                variant="outline"
                                aria-label={t('common.status')}
                                className={cn(
                                    'h-8 shrink-0 tracking-wide',
                                    styles.badgeClassName,
                                )}
                            >
                                <StatusIcon data-icon="inline-start" />
                                {jobStatusLabel(execution.status, t)}
                            </Badge>
                            <SummaryProgress
                                label={t('jobs.progress')}
                                progress={execution.progress}
                                progressClassName={styles.progressClassName}
                            />
                            <SummaryMetric
                                icon={ListChecksIcon}
                                label={t('jobs.results')}
                                value={String(execution.results.length)}
                            />
                            <SummaryDate
                                icon={CalendarClockIcon}
                                label={t('jobs.created')}
                                value={formatJobDate(
                                    execution.createdAt,
                                    locale,
                                    t('common.notAvailable'),
                                )}
                            />
                            <SummaryDate
                                icon={Clock3Icon}
                                label={t('jobs.submitted')}
                                value={formatJobDate(
                                    execution.submittedAt,
                                    locale,
                                    t('common.notAvailable'),
                                )}
                            />
                            <SummaryDate
                                icon={TimerIcon}
                                label={terminalLabel}
                                value={formatJobDate(
                                    terminalTimestamp,
                                    locale,
                                    t('common.notAvailable'),
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <JobNoteCard execution={execution} />

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
                    {execution.results.length > 0 ? (
                        <div className="flex min-w-0 flex-col gap-3">
                            {visualResults.map((item) =>
                                item.kind === 'geotiff-map' ? (
                                    <GeoTiffMapResultPreview
                                        key={`map-${item.outputId}`}
                                        executionId={execution.id}
                                        title={item.title}
                                        description={item.description}
                                        geotiff={item.geotiff}
                                        sld={item.sld}
                                    />
                                ) : (
                                    <ResultPreview
                                        key={item.result.id}
                                        executionId={execution.id}
                                        result={item.result}
                                    />
                                ),
                            )}
                        </div>
                    ) : (
                        <AlertResultsEmpty
                            title={t('jobs.noResultsTitle')}
                            description={t('jobs.noResultsDescription')}
                        />
                    )}
                </DetailSection>

                {execution.requestPayload !== undefined ? (
                    <DetailSection
                        icon={FileInputIcon}
                        title={t('jobs.inputs')}
                        description={t('jobs.inputsDescription')}
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
                        <JsonBlock
                            title={t('jobs.inputs')}
                            value={execution.requestPayload}
                        />
                    </DetailSection>
                ) : null}
            </div>
        </>
    );
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
    children,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    badge?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card className="min-w-0 shadow-sm dark:border-border/70 dark:bg-card/95">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <CardTitleWithIcon titleIcon={Icon}>
                        {title}
                    </CardTitleWithIcon>
                    <CardDescription>{description}</CardDescription>
                </div>
                {badge}
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4">
                {children}
            </CardContent>
        </Card>
    );
}

function CardTitleWithIcon({
    titleIcon: Icon,
    children,
}: {
    titleIcon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <CardTitle className="flex min-w-0 items-center gap-2">
            <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 truncate">{children}</span>
        </CardTitle>
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

function JobMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-md border bg-card p-3 shadow-sm dark:border-border/70 dark:bg-card/95">
            <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                    {label}
                </p>
                <p className="truncate text-sm font-semibold" title={value}>
                    {value}
                </p>
            </div>
        </div>
    );
}

function SummaryMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border bg-background/60 px-2.5 text-xs dark:border-border/70 dark:bg-background/20">
            <Icon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
        </div>
    );
}

function SummaryProgress({
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
        <div className="flex h-8 min-w-40 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-xs dark:border-border/70 dark:bg-background/20">
            <TimerIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="text-muted-foreground">{label}</span>
            <div
                className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
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
            <span className="font-semibold tabular-nums">{progress}%</span>
        </div>
    );
}

function SummaryDate({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border bg-background/60 px-2.5 text-xs dark:border-border/70 dark:bg-background/20">
            <Icon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="text-muted-foreground">{label}</span>
            <span className="max-w-32 truncate font-medium tabular-nums sm:max-w-40">
                {value}
            </span>
        </div>
    );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                {title}
            </h3>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs ring-1 ring-border/50 dark:bg-muted/50 dark:text-foreground">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}
