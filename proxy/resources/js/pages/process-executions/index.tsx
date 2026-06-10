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

const columnLabels: Record<string, string> = {
    process: 'Process',
    status: 'Status',
    remoteJobId: 'Job ID',
    message: 'Message',
    createdAt: 'Created',
    submittedAt: 'Submitted',
    finishedAt: 'Finished',
    progress: 'Progress',
};

const columnClassNames: Record<string, string> = {
    process: 'min-w-56 whitespace-normal',
    status: 'min-w-32',
    remoteJobId: 'w-[300px] max-w-[300px]',
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
            <SortableHeader column={column} title="Process" />
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
                    {row.original.message ?? 'No job message available.'}
                </span>
            </div>
        ),
    },
    {
        accessorKey: 'status',
        header: ({ column }) => (
            <SortableHeader column={column} title="Status" />
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
            <SortableHeader column={column} title="Job ID" />
        ),
        cell: ({ row }) => {
            const displayJobId =
                row.original.remoteJobId ?? `Local #${row.original.id}`;

            return (
                <code className="block max-w-[300px] overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs whitespace-nowrap dark:bg-muted/70">
                    {displayJobId}
                </code>
            );
        },
    },
    {
        accessorKey: 'message',
        header: ({ column }) => (
            <SortableHeader column={column} title="Message" />
        ),
        cell: ({ row }) => (
            <span className="line-clamp-2 max-w-sm text-muted-foreground">
                {row.original.message ?? 'No job message available.'}
            </span>
        ),
    },
    {
        accessorKey: 'createdAt',
        header: ({ column }) => (
            <SortableHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
            <span className="text-muted-foreground">
                {formatJobDate(row.original.createdAt)}
            </span>
        ),
        sortingFn: (first, second) =>
            dateSortValue(first.original.createdAt) -
            dateSortValue(second.original.createdAt),
    },
    {
        accessorKey: 'submittedAt',
        header: ({ column }) => (
            <SortableHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => (
            <span className="text-muted-foreground">
                {formatJobDate(row.original.submittedAt)}
            </span>
        ),
        sortingFn: (first, second) =>
            dateSortValue(first.original.submittedAt) -
            dateSortValue(second.original.submittedAt),
    },
    {
        id: 'finishedAt',
        accessorFn: (execution) =>
            execution.completedAt ?? execution.failedAt ?? null,
        header: ({ column }) => (
            <SortableHeader column={column} title="Finished" />
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
                title="Progress"
                className="ml-auto"
            />
        ),
        cell: ({ row }) => <JobProgress execution={row.original} />,
    },
    {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
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
        ],
        [executions.data.length, statusCounts],
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
            <Head title="My Jobs" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            Process runs
                        </p>
                        <h1 className="text-2xl font-semibold">My Jobs</h1>
                        <p className="text-sm text-muted-foreground">
                            {filteredRowsCount} of {executions.data.length} jobs
                            shown
                        </p>
                        <JobPollingIndicator
                            active={hasActiveJobs}
                            activeLabel="Polling active: refreshing running jobs"
                            inactiveLabel="Polling inactive: no running jobs"
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
                                placeholder="Search process, job ID, status or message..."
                                className="pl-9"
                                aria-label="Search jobs"
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
                                Reset filters
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
                                aria-label="Rows per page"
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
                                            {pageSize} / page
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Columns3Icon data-icon="inline-start" />
                                    Columns
                                    <ChevronDownIcon data-icon="inline-end" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>
                                    Visible columns
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
                                            {columnLabels[column.id] ??
                                                column.id}
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
                                        No jobs match the current filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{' '}
                        {pageCount}
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
                            First
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronLeftIcon data-icon="inline-start" />
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronRightIcon data-icon="inline-start" />
                            Next
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
                            Last
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
            href: index(),
        },
    ],
};

function SortableHeader({
    column,
    title,
    className,
}: {
    column: Column<ProcessExecutionListItem, unknown>;
    title: string;
    className?: string;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('-ml-2 h-8 px-2', className)}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
            {title}
            <ArrowUpDownIcon data-icon="inline-end" />
        </Button>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles = jobStatusStyles(status);
    const StatusIcon = styles.icon;

    return (
        <Badge
            variant="outline"
            className={cn('tracking-wide', styles.badgeClassName)}
        >
            <StatusIcon data-icon="inline-start" />
            {styles.label}
        </Badge>
    );
}

function JobFinishedAt({ execution }: { execution: ProcessExecutionListItem }) {
    const terminalTimestamp = execution.completedAt ?? execution.failedAt;
    const terminalLabel = execution.completedAt
        ? 'Completed'
        : execution.failedAt
          ? 'Failed'
          : 'Finished';

    return (
        <div className="flex flex-col gap-1 text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
                {terminalLabel}
            </span>
            <span>{formatJobDate(terminalTimestamp)}</span>
        </div>
    );
}

function JobProgress({ execution }: { execution: ProcessExecutionListItem }) {
    const styles = jobStatusStyles(execution.status);
    const progress = clampProgress(execution.progress);

    return (
        <div className="flex w-28 flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                <span>Progress</span>
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
    return (
        <Button asChild variant="default" size="sm">
            <Link
                href={show(execution.id)}
                onClick={(event) => event.stopPropagation()}
            >
                <ListChecksIcon data-icon="inline-start" />
                Details
            </Link>
        </Button>
    );
}

function dateSortValue(value?: string | null): number {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
}
