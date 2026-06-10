import { Head, Link } from '@inertiajs/react';
import {
    CalendarClockIcon,
    Clock3Icon,
    HashIcon,
    ListChecksIcon,
    ListFilterIcon,
    TimerIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    clampProgress,
    formatJobDate,
    jobStatusSortIndex,
    jobStatusStyles,
} from '@/lib/jobs';
import { cn } from '@/lib/utils';
import { index, show } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type PaginatedExecutions = {
    data: ProcessExecutionListItem[];
};

export default function ProcessExecutionIndex({
    executions,
}: {
    executions: PaginatedExecutions;
}) {
    const [statusFilter, setStatusFilter] = useState('all');
    const statusCounts = executions.data.reduce<Record<string, number>>(
        (counts, execution) => ({
            ...counts,
            [execution.status]: (counts[execution.status] ?? 0) + 1,
        }),
        {},
    );
    const statusOptions = [
        {
            value: 'all',
            label: 'ALL',
            count: executions.data.length,
            icon: ListFilterIcon,
        },
        ...Object.keys(statusCounts)
            .sort(
                (first, second) =>
                    jobStatusSortIndex(first) - jobStatusSortIndex(second),
            )
            .map((status) => {
                const styles = jobStatusStyles(status);

                return {
                    value: status,
                    label: styles.label,
                    count: statusCounts[status],
                    icon: styles.icon,
                };
            }),
    ];
    const filteredExecutions =
        statusFilter === 'all'
            ? executions.data
            : executions.data.filter(
                  (execution) => execution.status === statusFilter,
              );

    return (
        <>
            <Head title="My Jobs" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            Process runs
                        </p>
                        <h1 className="text-2xl font-semibold">
                            My Jobs
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {filteredExecutions.length} of{' '}
                            {executions.data.length} jobs shown
                        </p>
                    </div>

                    <ToggleGroup
                        type="single"
                        value={statusFilter}
                        onValueChange={(value) =>
                            setStatusFilter(value || 'all')
                        }
                        variant="outline"
                        size="sm"
                        className="flex-wrap justify-start"
                    >
                        {statusOptions.map((option) => {
                            const Icon = option.icon;

                            return (
                                <ToggleGroupItem
                                    key={option.value}
                                    value={option.value}
                                    aria-label={`Filter ${option.label} jobs`}
                                >
                                    <Icon data-icon="inline-start" />
                                    {option.label}
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1 font-normal"
                                    >
                                        {option.count}
                                    </Badge>
                                </ToggleGroupItem>
                            );
                        })}
                    </ToggleGroup>
                </div>

                {filteredExecutions.length > 0 ? (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {filteredExecutions.map((execution) => (
                            <ExecutionCard
                                key={execution.id}
                                execution={execution}
                            />
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardHeader>
                            <CardTitle>No jobs for this status</CardTitle>
                            <CardDescription>
                                Choose another status filter to review previous
                                process runs.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>
        </>
    );
}

ProcessExecutionIndex.layout = {
    breadcrumbs: [
        {
            title: 'My Jobs',
            href: index(),
        },
    ],
};

function ExecutionCard({
    execution,
}: {
    execution: ProcessExecutionListItem;
}) {
    const styles = jobStatusStyles(execution.status);
    const StatusIcon = styles.icon;
    const terminalTimestamp = execution.completedAt ?? execution.failedAt;
    const terminalLabel = execution.completedAt
        ? 'Completed'
        : execution.failedAt
          ? 'Failed'
          : 'Finished';

    return (
        <Card
            className={cn(
                'min-w-0 border-l-4 transition-colors',
                styles.cardClassName,
            )}
        >
            <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                            {execution.processTitle ?? execution.processId}
                        </CardTitle>
                        <CardDescription className="truncate">
                            {execution.processId}
                        </CardDescription>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn('shrink-0 tracking-wide', styles.badgeClassName)}
                    >
                        <StatusIcon data-icon="inline-start" />
                        {styles.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                    {execution.message ?? 'No execution message available.'}
                </p>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <ExecutionMetaItem
                        icon={HashIcon}
                        label="Job ID"
                        value={execution.remoteJobId ?? `Local #${execution.id}`}
                        monospace
                    />
                    <ExecutionMetaItem
                        icon={CalendarClockIcon}
                        label="Created"
                        value={formatJobDate(execution.createdAt)}
                    />
                    <ExecutionMetaItem
                        icon={Clock3Icon}
                        label="Submitted"
                        value={formatJobDate(execution.submittedAt)}
                    />
                    <ExecutionMetaItem
                        icon={TimerIcon}
                        label={terminalLabel}
                        value={formatJobDate(terminalTimestamp)}
                    />
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
                        aria-valuenow={execution.progress}
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
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                    Run #{execution.id}
                </p>
                <Button asChild variant="outline" size="sm">
                    <Link href={show(execution.id)}>
                        <ListChecksIcon data-icon="inline-start" />
                        Details
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

function ExecutionMetaItem({
    icon: Icon,
    label,
    value,
    monospace = false,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    monospace?: boolean;
}) {
    return (
        <div className="flex min-w-0 items-start gap-2 rounded-md border bg-background/70 p-3">
            <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                    {label}
                </p>
                <p
                    className={cn(
                        'truncate text-sm font-medium',
                        monospace && 'font-mono text-xs',
                    )}
                    title={value}
                >
                    {value}
                </p>
            </div>
        </div>
    );
}
