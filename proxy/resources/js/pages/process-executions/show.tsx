import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    CalendarClockIcon,
    Clock3Icon,
    HashIcon,
    InfoIcon,
    ListChecksIcon,
    PackageCheckIcon,
    TimerIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import CopyableJobId from '@/components/ogc/copyable-job-id';
import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
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
    const displayJobId =
        execution.remoteJobId ??
        t('jobs.localIdentifier', {
            id: execution.id,
        });
    const terminalTimestamp = execution.completedAt ?? execution.failedAt;
    const terminalLabel = execution.completedAt
        ? t('jobs.completed')
        : execution.failedAt
          ? t('jobs.failed')
          : t('jobs.finished');
    const isPolling = !isJobTerminal(execution.status);

    return (
        <>
            <Head title={t('jobs.documentTitle', { jobId: displayJobId })} />

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
                                    {execution.processTitle ??
                                        execution.processId}
                                </h1>
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
                                {execution.processId}
                                {execution.processVersion
                                    ? ` v${execution.processVersion}`
                                    : ''}
                            </p>
                            <JobPollingIndicator
                                active={isPolling}
                                activeLabel={t('jobs.pollingShowActive')}
                                inactiveLabel={t('jobs.pollingShowInactive')}
                                interval={pollingInterval}
                                only={['execution', 'pollingInterval']}
                            />
                            <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
                                <span className="font-medium text-muted-foreground">
                                    {t('jobs.jobId')}
                                </span>
                                <CopyableJobId displayJobId={displayJobId} />
                            </div>
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

                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
                    <section className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-col gap-1">
                                <h2 className="text-lg font-semibold">
                                    {t('jobs.results')}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {t(
                                        execution.results.length === 1
                                            ? 'ogc.outputCountOne'
                                            : 'ogc.outputCountMany',
                                        { count: execution.results.length },
                                    )}
                                </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                                <PackageCheckIcon data-icon="inline-start" />
                                {execution.results.length}
                            </Badge>
                        </div>

                        {execution.results.length > 0 ? (
                            <div className="flex min-w-0 flex-col gap-3">
                                {execution.results.map((result) => (
                                    <ResultPreview
                                        key={result.id}
                                        executionId={execution.id}
                                        result={result}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Card className="shadow-sm dark:bg-card/95">
                                <CardHeader>
                                    <CardTitle>
                                        {t('jobs.noResultsTitle')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('jobs.noResultsDescription')}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </section>

                    <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
                        <Card
                            className={cn(
                                'min-w-0 border-l-4 shadow-sm',
                                styles.cardClassName,
                            )}
                        >
                            <CardHeader>
                                <CardTitle>{t('jobs.jobSummary')}</CardTitle>
                                <CardDescription>
                                    {t('jobs.currentState')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex min-w-0 flex-col gap-4">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                                        {t('common.status').toUpperCase()}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'tracking-wide',
                                            styles.badgeClassName,
                                        )}
                                    >
                                        <StatusIcon data-icon="inline-start" />
                                        {jobStatusLabel(execution.status, t)}
                                    </Badge>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                                        <span>{t('jobs.progress')}</span>
                                        <span className="tabular-nums">
                                            {execution.progress}%
                                        </span>
                                    </div>
                                    <div
                                        className="h-2 overflow-hidden rounded-full bg-muted"
                                        role="progressbar"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={clampProgress(
                                            execution.progress,
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-[width]',
                                                styles.progressClassName,
                                            )}
                                            style={{
                                                width: `${clampProgress(execution.progress)}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <JobTimelineItem
                                        icon={CalendarClockIcon}
                                        label={t('jobs.created')}
                                        value={formatJobDate(
                                            execution.createdAt,
                                            locale,
                                            t('common.notAvailable'),
                                        )}
                                    />
                                    <JobTimelineItem
                                        icon={Clock3Icon}
                                        label={t('jobs.submitted')}
                                        value={formatJobDate(
                                            execution.submittedAt,
                                            locale,
                                            t('common.notAvailable'),
                                        )}
                                    />
                                    <JobTimelineItem
                                        icon={TimerIcon}
                                        label={terminalLabel}
                                        value={formatJobDate(
                                            terminalTimestamp,
                                            locale,
                                            t('common.notAvailable'),
                                        )}
                                    />
                                </div>

                                <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground dark:bg-muted/60">
                                    <InfoIcon
                                        aria-hidden="true"
                                        className="mt-0.5 size-4 shrink-0"
                                    />
                                    <p className="min-w-0">
                                        {execution.message ??
                                            t('jobs.noJobMessage')}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <JobNoteCard execution={execution} />

                        <Card className="min-w-0 shadow-sm dark:border-border/70 dark:bg-card/95">
                            <CardHeader>
                                <CardTitle>{t('jobs.request')}</CardTitle>
                                <CardDescription>
                                    {t('jobs.requestDescription')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex min-w-0 flex-col gap-4">
                                <JsonBlock
                                    title={t('jobs.inputs')}
                                    value={execution.requestPayload}
                                />
                                <JsonBlock
                                    title={t('jobs.requestedOutputs')}
                                    value={execution.requestedOutputs ?? {}}
                                />
                            </CardContent>
                        </Card>
                    </aside>
                </div>
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

function JobTimelineItem({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex min-w-0 items-start gap-3">
            <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                    {label}
                </p>
                <p className="truncate text-sm font-medium" title={value}>
                    {value}
                </p>
            </div>
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
