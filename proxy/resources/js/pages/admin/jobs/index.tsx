import { Head, router } from '@inertiajs/react';
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
    RowSelectionState,
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
    ListFilterIcon,
    SearchIcon,
    Trash2Icon,
    XIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { DataTableBulkActions } from '@/components/data-table-bulk-actions';
import type { BulkActionPayload } from '@/components/data-table-bulk-actions';
import { createSelectColumn } from '@/components/data-table-select-column';
import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
import JobIdentifiers from '@/components/ogc/job-identifiers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';
import type { TranslationKey } from '@/lib/i18n/translation';
import { consumeAdminJobsIndexStale } from '@/lib/job-list-refresh';
import {
    clampProgress,
    formatJobDate,
    jobStatusSortIndex,
    jobStatusStyles,
} from '@/lib/jobs';
import { cn } from '@/lib/utils';
import { index } from '@/routes/admin/jobs';
import { bulkDestroy, show } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type Translate = ReturnType<typeof useTranslation>['t'];

type AdminJob = ProcessExecutionListItem & {
    owner: {
        id: number;
        name: string;
        email: string;
        avatar: string | null;
    };
};

type AdminJobUser = {
    id: number;
    name: string;
    email: string;
    jobFilter: string;
};

type PaginatedJobs = {
    data: AdminJob[];
    from: number | null;
    to: number | null;
    total: number;
};

type AdminJobFilters = {
    search: string;
    selectedUserId: number | null;
};

const columnLabelKeys: Record<string, TranslationKey> = {
    user: 'common.user',
    process: 'jobs.process',
    status: 'common.status',
    jobId: 'jobs.jobId',
    message: 'jobs.message',
    submittedAt: 'jobs.submitted',
    finishedAt: 'jobs.finished',
    progress: 'jobs.progress',
};

const columnClassNames: Record<string, string> = {
    select: 'w-12',
    user: 'min-w-56 whitespace-normal',
    process: 'min-w-56 whitespace-normal',
    status: 'min-w-32',
    jobId: 'min-w-44 whitespace-nowrap',
    message: 'min-w-64 whitespace-normal',
    submittedAt: 'min-w-36',
    finishedAt: 'min-w-40',
    progress: 'min-w-32',
    actions: 'w-14 text-right',
};

const columns: ColumnDef<AdminJob>[] = [
    {
        id: 'jobSearch',
        accessorFn: (execution) =>
            [
                execution.owner.name,
                execution.owner.email,
                execution.name,
                execution.displayName,
                execution.processTitle,
                execution.processId,
                execution.id,
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
        id: 'userId',
        accessorFn: (execution) => execution.owner.id,
        filterFn: (row, columnId, filterValue) =>
            !filterValue ||
            filterValue === 'all' ||
            String(row.getValue<number>(columnId)) === String(filterValue),
        enableHiding: false,
        enableSorting: false,
    },
    createSelectColumn<AdminJob>(),
    {
        id: 'user',
        accessorFn: (execution) =>
            `${execution.owner.name} ${execution.owner.email}`,
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="common.user" />
        ),
        cell: ({ row }) => <AdminJobUserIdentity owner={row.original.owner} />,
    },
    {
        id: 'process',
        accessorFn: (execution) => execution.displayName,
        header: ({ column }) => (
            <SortableHeader column={column} titleKey="jobs.process" />
        ),
        cell: ({ row }) => (
            <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{row.original.displayName}</span>
                <span className="text-xs text-muted-foreground">
                    {row.original.processTitle ?? row.original.processId} -{' '}
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
        id: 'jobId',
        accessorFn: (execution) => execution.id,
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

export default function AdminJobsIndex({
    executions,
    filters,
    users,
}: {
    executions: PaginatedJobs;
    filters: AdminJobFilters;
    users: AdminJobUser[];
}) {
    'use no memo';

    const { t } = useTranslation();
    const [sorting, setSorting] = useState<SortingState>([
        { id: 'submittedAt', desc: true },
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
        () => {
            const initialFilters: ColumnFiltersState = [];

            if (filters.search) {
                initialFilters.push({
                    id: 'jobSearch',
                    value: filters.search,
                });
            }

            if (filters.selectedUserId !== null) {
                initialFilters.push({
                    id: 'userId',
                    value: String(filters.selectedUserId),
                });
            }

            return initialFilters;
        },
    );
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
        finishedAt: false,
        jobSearch: false,
        message: false,
        userId: false,
    });
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [bulkProcessing, setBulkProcessing] = useState(false);
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
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: {
            columnFilters,
            columnVisibility,
            pagination,
            rowSelection,
            sorting,
        },
    });
    const selectedExecutions = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original);
    const statusFilter =
        (table.getColumn('status')?.getFilterValue() as string | undefined) ??
        'all';
    const searchFilter =
        (table.getColumn('jobSearch')?.getFilterValue() as
            string | undefined) ?? '';
    const selectedUserId =
        (table.getColumn('userId')?.getFilterValue() as string | undefined) ??
        (filters.selectedUserId === null
            ? 'all'
            : String(filters.selectedUserId));
    const filteredRowsCount = table.getFilteredRowModel().rows.length;
    const pageCount = Math.max(table.getPageCount(), 1);
    const hasActiveFilters =
        statusFilter !== 'all' ||
        searchFilter !== '' ||
        selectedUserId !== 'all';

    useEffect(() => {
        if (!consumeAdminJobsIndexStale()) {
            return;
        }

        router.reload({ only: ['executions'] });
    }, []);

    function bulkDeleteSelectedJobs(): void {
        const ids = selectedExecutions.map((execution) => execution.id);

        if (ids.length === 0) {
            return;
        }

        setBulkProcessing(true);

        router.delete<BulkActionPayload>(bulkDestroy.url(), {
            data: { ids },
            preserveScroll: true,
            onSuccess: () => table.resetRowSelection(),
            onFinish: () => setBulkProcessing(false),
        });
    }

    function selectUser(value: string): void {
        const nextUserId = value === 'all' ? undefined : value;
        const nextUser = users.find((user) => String(user.id) === nextUserId);
        const query = {
            ...(searchFilter ? { search: searchFilter } : {}),
            ...(nextUser ? { user: nextUser.jobFilter } : {}),
        };

        table.getColumn('userId')?.setFilterValue(nextUserId);
        table.setPageIndex(0);

        router.get(
            index.url({ query }),
            {},
            { preserveScroll: true, replace: true },
        );
    }

    return (
        <>
            <Head title={t('admin.allJobs')} />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            {t('admin.administration')}
                        </p>
                        <h1 className="text-2xl font-semibold">
                            {t('admin.allJobs')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('admin.shownJobs', {
                                shown: filteredRowsCount,
                                total: executions.data.length,
                            })}
                        </p>
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
                                placeholder={t('admin.searchJobsPlaceholder')}
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
                                    router.get(
                                        index.url(),
                                        {},
                                        { preserveScroll: true, replace: true },
                                    );
                                }}
                            >
                                <XIcon data-icon="inline-start" />
                                {t('jobs.resetFilters')}
                            </Button>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={selectedUserId}
                            onValueChange={selectUser}
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-full sm:w-96 xl:w-[28rem]"
                                aria-label={t('admin.jobsByUser')}
                            >
                                <SelectValue
                                    placeholder={t('admin.allUsers')}
                                />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectGroup>
                                    <SelectItem value="all">
                                        {t('admin.allUsers')}
                                    </SelectItem>
                                    {users.map((user) => (
                                        <SelectItem
                                            key={user.id}
                                            value={`${user.id}`}
                                        >
                                            {user.name} ({user.email})
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>

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

                <DataTableBulkActions
                    selectedCount={selectedExecutions.length}
                    selectionLabel={t('jobs.selectedJobs', {
                        count: selectedExecutions.length,
                    })}
                    processing={bulkProcessing}
                    onClearSelection={() => table.resetRowSelection()}
                    actions={[
                        {
                            id: 'delete',
                            label: t('jobs.bulkDelete'),
                            title: t('jobs.bulkDeleteTitle'),
                            description: t('jobs.bulkDeleteDescription'),
                            confirmLabel: t('jobs.bulkDeleteConfirm'),
                            icon: Trash2Icon,
                            variant: 'destructive',
                            onConfirm: bulkDeleteSelectedJobs,
                        },
                    ]}
                />

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
                                            data-state={
                                                row.getIsSelected()
                                                    ? 'selected'
                                                    : undefined
                                            }
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
                                        {hasActiveFilters
                                            ? t('jobs.noJobsMatch')
                                            : t('admin.noUserJobsStarted')}
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

function SortableHeader({
    column,
    titleKey,
    className,
}: {
    column: Column<AdminJob, unknown>;
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

function AdminJobUserIdentity({ owner }: { owner: AdminJob['owner'] }) {
    const getInitials = useInitials();

    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 rounded-full">
                <AvatarImage src={owner.avatar ?? undefined} alt={owner.name} />
                <AvatarFallback className="rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {getInitials(owner.name)}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{owner.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {owner.email}
                </span>
            </div>
        </div>
    );
}

function JobMessage({ message }: { message?: string | null }) {
    const { t } = useTranslation();

    return <>{message ?? t('jobs.noJobMessage')}</>;
}

function JobIdentifier({ execution }: { execution: AdminJob }) {
    return (
        <JobIdentifiers id={execution.id} remoteJobId={execution.remoteJobId} />
    );
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
    const Icon = styles.icon;
    const { t } = useTranslation();

    return (
        <Badge
            variant="outline"
            className={cn('tracking-wide', styles.badgeClassName)}
        >
            <Icon data-icon="inline-start" />
            {jobStatusLabel(status, t)}
        </Badge>
    );
}

function JobFinishedAt({ execution }: { execution: AdminJob }) {
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

function JobProgress({ execution }: { execution: AdminJob }) {
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

function JobRowActions({ execution }: { execution: AdminJob }) {
    return (
        <div className="flex justify-end">
            <DeleteJobButton
                execution={execution}
                owner={execution.owner}
                redirectBack
                showLabel={false}
            />
        </div>
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

AdminJobsIndex.layout = {
    breadcrumbs: [
        {
            title: 'All Jobs',
            titleKey: 'admin.allJobs',
            href: index(),
        },
    ],
};
