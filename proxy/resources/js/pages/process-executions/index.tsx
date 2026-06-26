import { Head, Link, router } from '@inertiajs/react';
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type {
    Column,
    ColumnDef,
    ColumnFiltersState,
    PaginationState,
    SortingState,
    VisibilityState,
} from '@tanstack/react-table';
import {
    ArrowUpDownIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    Columns3Icon,
    ListChecksIcon,
    ListFilterIcon,
    SearchIcon,
    XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import CopyableJobId from '@/components/ogc/copyable-job-id';
import JobPollingIndicator from '@/components/ogc/job-polling-indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import type { TranslationKey } from '@/lib/i18n/translation';
import {
    clampProgress,
    formatJobDate,
    isJobTerminal,
    jobStatusSortIndex,
    jobStatusStyles,
} from '@/lib/jobs';
import { cn } from '@/lib/utils';
import { index, show } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type PaginatedExecutions = {
    data: ProcessExecutionListItem[];
};

type Translate = ReturnType<typeof useTranslation>['t'];

const columnLabelKeys: Record<string, TranslationKey> = {
    process: 'jobs.process',
    status: 'common.status',
    remoteJobId: 'jobs.jobId',
    message: 'jobs.message',
    createdAt: 'jobs.created',
    submittedAt: 'jobs.submitted',
    finishedAt: 'jobs.finished',
    progress: 'jobs.progress',
};

const columnClassNames: Record<string, string> = {
    process: 'min-w-56 whitespace-normal',
    status: 'min-w-32',
    remoteJobId: 'whitespace-nowrap',
    message: 'min-w-64 whitespace-normal',
    createdAt: 'min-w-36',
    submittedAt: 'min-w-36',
    finishedAt: 'min-w-40',
    progress: 'min-w-32',
    actions: 'w-28 text-right',
};

const columns: ColumnDef<ProcessExecutionListItem>[] = [
    {
        id: 'jobSearch',
        accessorFn: (execution) =>
            [
                execution.processTitle,
                execution.processId,
                execution.remoteJobId,
                execution.message,
                execution.status,
            ]
                .filter(Boolean)
                .join(' '),
        filterFn: (row, columnId, filterValue) =>
            row
                .getValue<string>(columnId)
                .toLowerCase()
                .includes(String(filterValue).toLowerCase()),
        enableHiding: false,
        enableSorting: false,
    },
    {
        id: 'process',
        accessorFn: (execution) =>
            execution.processTitle ?? execution.processId,
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.process" />
        ),
        cell: ({ row }) => (
            <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">
                    {row.original.processTitle ?? row.original.processId}
                </span>
                <span className="text-xs text-muted-foreground">
                    {row.original.processId}
                </span>
                <span className="line-clamp-2 max-w-xl text-xs text-muted-foreground">
                    <JobMessage message={row.original.message} />
                </span>
            </div>
        ),
    },
    {
        accessorKey: 'status',
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="common.status" />
        ),
        cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
        filterFn: (row, columnId, filterValue) =>
            !filterValue ||
            filterValue === 'all' ||
            row.getValue(columnId) === filterValue,
        sortingFn: (first, second, columnId) =>
            jobStatusSortIndex(first.getValue<string>(columnId)) -
            jobStatusSortIndex(second.getValue<string>(columnId)),
    },
    {
        accessorKey: 'remoteJobId',
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.jobId" />
        ),
        cell: ({ row }) => <JobIdentifier execution={row.original} />,
    },
    {
        accessorKey: 'message',
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.message" />
        ),
        cell: ({ row }) => (
            <span className="line-clamp-2 max-w-sm text-muted-foreground">
                <JobMessage message={row.original.message} />
            </span>
        ),
    },
    {
        accessorKey: 'createdAt',
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.created" />
        ),
        cell: ({ row }) => <JobDate value={row.original.createdAt} />,
        sortingFn: (first, second) =>
            dateSortValue(first.original.createdAt) -
            dateSortValue(second.original.createdAt),
    },
    {
        accessorKey: 'submittedAt',
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.submitted" />
        ),
        cell: ({ row }) => <JobDate value={row.original.submittedAt} />,
        sortingFn: (first, second) =>
            dateSortValue(first.original.submittedAt) -
            dateSortValue(second.original.submittedAt),
    },
    {
        id: 'finishedAt',
        accessorFn: (execution) =>
            execution.completedAt ?? execution.failedAt ?? null,
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.finished" />
        ),
        cell: ({ row }) => <JobFinishedAt execution={row.original} />,
        sortingFn: (first, second) =>
            dateSortValue(
                first.original.completedAt ?? first.original.failedAt,
            ) -
            dateSortValue(
                second.original.completedAt ?? second.original.failedAt,
            ),
    },
    {
        accessorKey: 'progress',
        header: ({ column }) => (
            <SortableHeader
                column={column}
                titleKey="jobs.progress"
                className="ml-auto"
            />
        ),
        cell: ({ row }) => <JobProgress execution={row.original} />,
    },
    {
        id: 'actions',
        header: () => <ActionsHeader />,
        cell: ({ row }) => <JobRowActions execution={row.original} />,
        enableHiding: false,
        enableSorting: false,
    },
];

export default function ProcessExecutionIndex({
    executions,
    pollingInterval,
}: {
    executions: PaginatedExecutions;
    pollingInterval: number;
}) {
    const { t } = useTranslation();
    const [sorting, setSorting] = useState<SortingState>([
        { id: 'createdAt', desc: true },
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
        finishedAt: false,
        jobSearch: false,
        message: false,
        submittedAt: false,
    });
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};

        for (const execution of executions.data) {
            counts[execution.status] = (counts[execution.status] ?? 0) + 1;
        }

        return counts;
    }, [executions.data]);
    const statusOptions = useMemo(
        () => [
            {
                value: 'all',
                label: t('jobs.all'),
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
                        label: jobStatusLabel(status, t),
                        count: statusCounts[status],
                        icon: styles.icon,
                    };
                }),
        ],
        [executions.data.length, statusCounts, t],
    );
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: executions.data,
        columns,
        getRowId: (row) => String(row.id),
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: {
            columnFilters,
            columnVisibility,
            pagination,
            sorting,
        },
    });
    const statusFilter =
        (table.getColumn('status')?.getFilterValue() as string | undefined) ??
        'all';
    const searchFilter =
        (table.getColumn('jobSearch')?.getFilterValue() as
            | string
            | undefined) ?? '';
    const filteredRowsCount = table.getFilteredRowModel().rows.length;
    const pageCount = Math.max(table.getPageCount(), 1);
    const hasActiveFilters = statusFilter !== 'all' || searchFilter !== '';
    const hasActiveJobs = useMemo(
        () =>
            executions.data.some(
                (execution) => !isJobTerminal(execution.status),
            ),
        [executions.data],
    );

    return (
        <>
            <Head title={t('jobs.title')} />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            {t('jobs.processRuns')}
                        </p>
                        <h1 className="text-2xl font-semibold">
                            {t('jobs.title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('jobs.shown', {
                                shown: filteredRowsCount,
                                total: executions.data.length,
                            })}
                        </p>
                        <JobPollingIndicator
                            active={hasActiveJobs}
                            activeLabel={t('jobs.pollingActive')}
                            inactiveLabel={t('jobs.pollingInactive')}
                            interval={pollingInterval}
                            only={['executions', 'pollingInterval']}
                        />
                    </div>

                    <ToggleGroup
                        type="single"
                        value={statusFilter}
                        onValueChange={(value) => {
                            const nextValue = value || 'all';

                            table
                                .getColumn('status')
                                ?.setFilterValue(
                                    nextValue === 'all' ? undefined : nextValue,
                                );
                            table.setPageIndex(0);
                        }}
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
                                    aria-label={t('jobs.filterJobs', {
                                        status: option.label,
                                    })}
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

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-[34rem] xl:w-[42rem]">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchFilter}
                                onChange={(event) => {
                                    table
                                        .getColumn('jobSearch')
                                        ?.setFilterValue(
                                            event.target.value || undefined,
                                        );
                                    table.setPageIndex(0);
                                }}
                                placeholder={t('jobs.searchPlaceholder')}
                                className="pl-9"
                                aria-label={t('jobs.searchAria')}
                            />
                        </div>

                        {hasActiveFilters ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    table.resetColumnFilters();
                                    table.setPageIndex(0);
                                }}
                            >
                                <XIcon data-icon="inline-start" />
                                {t('jobs.resetFilters')}
                            </Button>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value));
                            }}
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-32"
                                aria-label={t('jobs.rowsPerPage')}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectGroup>
                                    {[10, 20, 50].map((pageSize) => (
                                        <SelectItem
                                            key={pageSize}
                                            value={`${pageSize}`}
                                        >
                                            {t('jobs.pageRows', {
                                                count: pageSize,
                                            })}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Columns3Icon data-icon="inline-start" />
                                    {t('jobs.columns')}
                                    <ChevronDownIcon data-icon="inline-end" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>
                                    {t('jobs.visibleColumns')}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(
                                                    Boolean(value),
                                                )
                                            }
                                        >
                                            {columnLabelKeys[column.id]
                                                ? t(columnLabelKeys[column.id])
                                                : column.id}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="overflow-hidden rounded-md border bg-card shadow-sm dark:border-border/70 dark:bg-card/95">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className={cn(
                                                'align-middle',
                                                columnClassNames[
                                                    header.column.id
                                                ],
                                            )}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length > 0 ? (
                                table.getRowModel().rows.map((row) => {
                                    const styles = jobStatusStyles(
                                        row.original.status,
                                    );

                                    return (
                                        <TableRow
                                            key={row.id}
                                            onClick={() =>
                                                router.visit(
                                                    show(row.original.id),
                                                )
                                            }
                                            className={cn(
                                                'cursor-pointer align-top transition-colors hover:bg-accent/50 dark:hover:bg-accent/30',
                                                styles.rowClassName,
                                            )}
                                        >
                                            {row
                                                .getVisibleCells()
                                                .map((cell) => (
                                                    <TableCell
                                                        key={cell.id}
                                                        className={cn(
                                                            'align-top',
                                                            columnClassNames[
                                                                cell.column.id
                                                            ],
                                                        )}
                                                    >
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext(),
                                                        )}
                                                    </TableCell>
                                                ))}
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-28 text-center text-muted-foreground"
                                    >
                                        {t('jobs.noJobsMatch')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-sm text-muted-foreground">
                        {t('jobs.pagination', {
                            page: table.getState().pagination.pageIndex + 1,
                            pages: pageCount,
                        })}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronsLeftIcon data-icon="inline-start" />
                            {t('jobs.first')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronLeftIcon data-icon="inline-start" />
                            {t('common.previous')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronRightIcon data-icon="inline-start" />
                            {t('common.next')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                table.setPageIndex(table.getPageCount() - 1)
                            }
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronsRightIcon data-icon="inline-start" />
                            {t('jobs.last')}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

ProcessExecutionIndex.layout = {
    breadcrumbs: [
        {
            title: 'My Jobs',
            titleKey: 'jobs.title',
            href: index(),
        },
    ],
};

function SortableHeader({
    column,
    titleKey,
    className,
}: {
    column: Column<ProcessExecutionListItem, unknown>;
    titleKey: TranslationKey;
    className?: string;
}) {
    const { t } = useTranslation();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('-ml-2 h-8 px-2', className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
            {t(titleKey)}
            <ArrowUpDownIcon data-icon="inline-end" />
        </Button>
    );
}

function ActionsHeader() {
    const { t } = useTranslation();

    return <span className="sr-only">{t('jobs.actions')}</span>;
}

function JobMessage({ message }: { message?: string | null }) {
    const { t } = useTranslation();

    return <>{message ?? t('jobs.noJobMessage')}</>;
}

function JobIdentifier({ execution }: { execution: ProcessExecutionListItem }) {
    const { t } = useTranslation();
    const displayJobId =
        execution.remoteJobId ??
        t('jobs.localIdentifier', {
            id: execution.id,
        });

    return <CopyableJobId displayJobId={displayJobId} />;
}

function JobDate({ value }: { value?: string | null }) {
    const { locale, t } = useTranslation();

    return (
        <span className="text-muted-foreground">
            {formatJobDate(value, locale, t('common.notAvailable'))}
        </span>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles = jobStatusStyles(status);
    const StatusIcon = styles.icon;
    const { t } = useTranslation();

    return (
        <Badge
            variant="outline"
            className={cn('tracking-wide', styles.badgeClassName)}
        >
            <StatusIcon data-icon="inline-start" />
            {jobStatusLabel(status, t)}
        </Badge>
    );
}

function JobFinishedAt({ execution }: { execution: ProcessExecutionListItem }) {
    const { locale, t } = useTranslation();
    const terminalTimestamp = execution.completedAt ?? execution.failedAt;
    const terminalLabel = execution.completedAt
        ? t('jobs.completed')
        : execution.failedAt
          ? t('jobs.failed')
          : t('jobs.finished');

    return (
        <div className="flex flex-col gap-1 text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
                {terminalLabel}
            </span>
            <span>
                {formatJobDate(
                    terminalTimestamp,
                    locale,
                    t('common.notAvailable'),
                )}
            </span>
        </div>
    );
}

function JobProgress({ execution }: { execution: ProcessExecutionListItem }) {
    const styles = jobStatusStyles(execution.status);
    const progress = clampProgress(execution.progress);
    const { t } = useTranslation();

    return (
        <div className="flex w-28 flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                <span>{t('jobs.progress')}</span>
                <span className="tabular-nums">{progress}%</span>
            </div>
            <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
            >
                <div
                    className={cn(
                        'h-full rounded-full transition-[width]',
                        styles.progressClassName,
                    )}
                    style={{
                        width: `${progress}%`,
                    }}
                />
            </div>
        </div>
    );
}

function JobRowActions({ execution }: { execution: ProcessExecutionListItem }) {
    const { t } = useTranslation();

    return (
        <Button asChild variant="default" size="sm">
            <Link
                href={show(execution.id)}
                onClick={(event) => event.stopPropagation()}
            >
                <ListChecksIcon data-icon="inline-start" />
                {t('jobs.details')}
            </Link>
        </Button>
    );
}

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

function dateSortValue(value?: string | null): number {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
}
