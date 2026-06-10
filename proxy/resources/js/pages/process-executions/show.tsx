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
import {
    clampProgress,
    formatJobDate,
    jobStatusStyles,
} from '@/lib/jobs';
import { cn } from '@/lib/utils';
import { index } from '@/routes/jobs';
import type { ProcessExecutionDetail } from '@/types';

export default function ProcessExecutionShow({
    execution,
}: {
    execution: ProcessExecutionDetail;
}) {
    const styles = jobStatusStyles(execution.status);
    const StatusIcon = styles.icon;
    const displayJobId = execution.remoteJobId ?? `Local #${execution.id}`;
    const terminalTimestamp = execution.completedAt ?? execution.failedAt;
    const terminalLabel = execution.completedAt
        ? 'Completed'
        : execution.failedAt
          ? 'Failed'
          : 'Finished';

    return (
        <>
            <Head title={`Job ${displayJobId}`} />

            <div className="flex min-w-0 flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-col gap-3">
                        <Button asChild variant="ghost" size="sm" className="w-fit">
                            <Link href={index()}>
                                <ArrowLeftIcon data-icon="inline-start" />
                                Back to Jobs
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
                                    {styles.label}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {execution.processId}
                                {execution.processVersion
                                    ? ` v${execution.processVersion}`
                                    : ''}
                            </p>
                            <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
                                <span className="font-medium text-muted-foreground">
                                    Job ID
                                </span>
                                <code className="min-w-0 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                                    {displayJobId}
                                </code>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:w-[32rem]">
                        <JobMetric
                            icon={HashIcon}
                            label="Local"
                            value={`#${execution.id}`}
                        />
                        <JobMetric
                            icon={ListChecksIcon}
                            label="Results"
                            value={String(execution.results.length)}
                        />
                        <JobMetric
                            icon={TimerIcon}
                            label="Progress"
                            value={`${execution.progress}%`}
                        />
                    </div>
                </div>

                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
                    <section className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-col gap-1">
                                <h2 className="text-lg font-semibold">
                                    Results
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {execution.results.length} output
                                    {execution.results.length === 1 ? '' : 's'}
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
                            <Card>
                                <CardHeader>
                                    <CardTitle>No results yet</CardTitle>
                                    <CardDescription>
                                        The job has not produced stored outputs.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </section>

                    <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
                        <Card
                            className={cn(
                                'min-w-0 border-l-4',
                                styles.cardClassName,
                            )}
                        >
                            <CardHeader>
                                <CardTitle>Job Summary</CardTitle>
                                <CardDescription>
                                    Current state and timeline.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex min-w-0 flex-col gap-4">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                                        STATUS
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'tracking-wide',
                                            styles.badgeClassName,
                                        )}
                                    >
                                        <StatusIcon data-icon="inline-start" />
                                        {styles.label}
                                    </Badge>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                                        <span>Progress</span>
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
                                        label="Created"
                                        value={formatJobDate(
                                            execution.createdAt,
                                        )}
                                    />
                                    <JobTimelineItem
                                        icon={Clock3Icon}
                                        label="Submitted"
                                        value={formatJobDate(
                                            execution.submittedAt,
                                        )}
                                    />
                                    <JobTimelineItem
                                        icon={TimerIcon}
                                        label={terminalLabel}
                                        value={formatJobDate(terminalTimestamp)}
                                    />
                                </div>

                                <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                                    <InfoIcon
                                        aria-hidden="true"
                                        className="mt-0.5 size-4 shrink-0"
                                    />
                                    <p className="min-w-0">
                                        {execution.message ??
                                            'No job message available.'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle>Request</CardTitle>
                                <CardDescription>
                                    Submitted inputs and output preferences.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex min-w-0 flex-col gap-4">
                                <JsonBlock
                                    title="Inputs"
                                    value={execution.requestPayload}
                                />
                                <JsonBlock
                                    title="Requested Outputs"
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
            href: index(),
        },
    ],
};

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
        <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-3">
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
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}
