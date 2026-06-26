import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
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
    CheckCircle2Icon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    Columns3Icon,
    ListChecksIcon,
    ListFilterIcon,
    PencilIcon,
    PlusIcon,
    RotateCcwIcon,
    SaveIcon,
    SearchIcon,
    ShieldCheckIcon,
    InfoIcon,
    UserIcon,
    UserXIcon,
    XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import InputError from '@/components/input-error';
import {
    getSocialProviderStyle,
    SocialProviderIcon,
} from '@/components/social-provider-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { index as jobsIndex } from '@/routes/admin/jobs';
import {
    destroy as destroyUser,
    index,
    restore as restoreUser,
    store,
    update as updateUser,
} from '@/routes/admin/users';
import type { Auth } from '@/types';

type AdminUserRole = 'user' | 'admin';
type AdminUserStatus = 'active' | 'inactive';

type SocialProvider = {
    provider: string;
    label: string;
};

type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: AdminUserRole;
    is_admin: boolean;
    is_deactivated: boolean;
    deactivated_at: string | null;
    socialProviders: SocialProvider[];
    jobs_count: number;
    jobFilter: string;
    created_at: string | null;
};

type RoleOption = {
    value: AdminUserRole;
    label: string;
};

type PaginatedUsers = {
    data: AdminUser[];
    from: number | null;
    to: number | null;
    total: number;
};

type UserFormData = {
    name: string;
    email: string;
    email_confirmation: string;
    role: AdminUserRole;
};

type PageProps = {
    auth: Auth;
};

const columnLabels: Record<string, string> = {
    user: 'User',
    role: 'Role',
    socialProviders: 'Registered with',
    status: 'Status',
    jobs_count: 'Jobs',
    created_at: 'Created',
};

const columnClassNames: Record<string, string> = {
    user: 'min-w-64 whitespace-normal',
    role: 'min-w-28',
    socialProviders: 'min-w-40',
    status: 'min-w-32',
    jobs_count: 'min-w-24 text-right',
    created_at: 'min-w-40',
    actions: 'min-w-80 text-right',
};

export default function AdminUsersIndex({
    users,
    roles,
    filters,
}: {
    users: PaginatedUsers;
    roles: RoleOption[];
    filters: { search: string };
}) {
    const { auth } = usePage<PageProps>().props;
    const [createOpen, setCreateOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [statusUser, setStatusUser] = useState<AdminUser | null>(null);
    const [sorting, setSorting] = useState<SortingState>([
        { id: 'created_at', desc: true },
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
        filters.search ? [{ id: 'userSearch', value: filters.search }] : [],
    );
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
        userSearch: false,
    });
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    const columns = useMemo<ColumnDef<AdminUser>[]>(
        () => [
            {
                id: 'userSearch',
                accessorFn: (user) =>
                    [
                        user.name,
                        user.email,
                        user.role,
                        ...user.socialProviders.map(
                            (provider) => provider.label,
                        ),
                        user.is_deactivated ? 'inactive' : 'active',
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
                id: 'user',
                accessorFn: (user) => `${user.name} ${user.email}`,
                header: ({ column }) => (
                    <SortableHeader column={column} title="User" />
                ),
                cell: ({ row }) => (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                            {row.original.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {row.original.email}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'role',
                header: ({ column }) => (
                    <SortableHeader column={column} title="Role" />
                ),
                cell: ({ row }) => <RoleBadge role={row.original.role} />,
                filterFn: (row, columnId, filterValue) =>
                    !filterValue ||
                    filterValue === 'all' ||
                    row.getValue(columnId) === filterValue,
            },
            {
                id: 'socialProviders',
                accessorFn: (user) =>
                    user.socialProviders
                        .map((provider) => provider.label)
                        .join(' ') || 'LOCAL',
                header: ({ column }) => (
                    <SortableHeader column={column} title="Registered with" />
                ),
                cell: ({ row }) => (
                    <SocialProviderBadges
                        providers={row.original.socialProviders}
                    />
                ),
                filterFn: (row, columnId, filterValue) =>
                    row
                        .getValue<string>(columnId)
                        .toLowerCase()
                        .includes(String(filterValue).toLowerCase()),
            },
            {
                id: 'status',
                accessorFn: (user): AdminUserStatus =>
                    user.is_deactivated ? 'inactive' : 'active',
                header: ({ column }) => (
                    <SortableHeader column={column} title="Status" />
                ),
                cell: ({ row }) => <UserStatusBadge user={row.original} />,
                filterFn: (row, columnId, filterValue) =>
                    !filterValue ||
                    filterValue === 'all' ||
                    row.getValue(columnId) === filterValue,
            },
            {
                accessorKey: 'jobs_count',
                header: ({ column }) => (
                    <SortableHeader
                        column={column}
                        title="Jobs"
                        className="ml-auto"
                    />
                ),
                cell: ({ row }) => (
                    <span className="block text-right tabular-nums">
                        {row.original.jobs_count}
                    </span>
                ),
            },
            {
                accessorKey: 'created_at',
                header: ({ column }) => (
                    <SortableHeader column={column} title="Created" />
                ),
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {formatDate(row.original.created_at)}
                    </span>
                ),
                sortingFn: (first, second) =>
                    dateSortValue(first.original.created_at) -
                    dateSortValue(second.original.created_at),
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => {
                    const user = row.original;
                    const isSelf = user.id === auth.user?.id;
                    const statusAction = (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-disabled={isSelf}
                            className={cn(
                                user.is_deactivated
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25'
                                    : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-400/70 dark:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/25',
                                isSelf && 'cursor-not-allowed opacity-50',
                            )}
                            onClick={() => {
                                if (!isSelf) {
                                    setStatusUser(user);
                                }
                            }}
                        >
                            {user.is_deactivated ? (
                                <RotateCcwIcon data-icon="inline-start" />
                            ) : (
                                <UserXIcon data-icon="inline-start" />
                            )}
                            {user.is_deactivated ? 'RESTORE' : 'DEACTIVATE'}
                        </Button>
                    );

                    return (
                        <div className="flex justify-end gap-2">
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 hover:text-sky-900 dark:border-sky-400/70 dark:bg-sky-500/15 dark:text-sky-100 dark:hover:bg-sky-500/25"
                            >
                                <Link
                                    href={jobsIndex({
                                        query: { user: user.jobFilter },
                                    })}
                                >
                                    <ListChecksIcon data-icon="inline-start" />
                                    Jobs
                                </Link>
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingUser(user)}
                            >
                                <PencilIcon data-icon="inline-start" />
                                Edit
                            </Button>

                            {isSelf ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        {statusAction}
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="end"
                                        className="w-72"
                                    >
                                        <PopoverHeader>
                                            <PopoverTitle>
                                                Action unavailable
                                            </PopoverTitle>
                                            <PopoverDescription>
                                                You cannot change the status of
                                                your own account.
                                            </PopoverDescription>
                                        </PopoverHeader>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                statusAction
                            )}
                        </div>
                    );
                },
                enableHiding: false,
                enableSorting: false,
            },
        ],
        [auth.user?.id],
    );

    const statusCounts = useMemo(() => {
        const counts: Record<AdminUserStatus, number> = {
            active: 0,
            inactive: 0,
        };

        for (const user of users.data) {
            counts[user.is_deactivated ? 'inactive' : 'active'] += 1;
        }

        return counts;
    }, [users.data]);
    const roleCounts = useMemo(() => {
        const counts: Record<AdminUserRole, number> = {
            admin: 0,
            user: 0,
        };

        for (const user of users.data) {
            counts[user.role] += 1;
        }

        return counts;
    }, [users.data]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: users.data,
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
    const roleFilter =
        (table.getColumn('role')?.getFilterValue() as string | undefined) ??
        'all';
    const searchFilter =
        (table.getColumn('userSearch')?.getFilterValue() as
            | string
            | undefined) ?? '';
    const filteredRowsCount = table.getFilteredRowModel().rows.length;
    const pageCount = Math.max(table.getPageCount(), 1);
    const hasActiveFilters =
        statusFilter !== 'all' || roleFilter !== 'all' || searchFilter !== '';

    return (
        <>
            <Head title="All Users" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            Administration
                        </p>
                        <h1 className="text-2xl font-semibold">All Users</h1>
                        <p className="text-sm text-muted-foreground">
                            {filteredRowsCount} of {users.data.length} users
                            shown
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ToggleGroup
                            type="single"
                            value={statusFilter}
                            onValueChange={(value) => {
                                const nextValue = value || 'all';

                                table
                                    .getColumn('status')
                                    ?.setFilterValue(
                                        nextValue === 'all'
                                            ? undefined
                                            : nextValue,
                                    );
                                table.setPageIndex(0);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-wrap justify-start"
                        >
                            {[
                                {
                                    value: 'all',
                                    label: 'ALL',
                                    count: users.data.length,
                                    icon: ListFilterIcon,
                                },
                                {
                                    value: 'active',
                                    label: 'ACTIVE',
                                    count: statusCounts.active,
                                    icon: CheckCircle2Icon,
                                },
                                {
                                    value: 'inactive',
                                    label: 'INACTIVE',
                                    count: statusCounts.inactive,
                                    icon: UserXIcon,
                                },
                            ].map((option) => {
                                const Icon = option.icon;

                                return (
                                    <ToggleGroupItem
                                        key={option.value}
                                        value={option.value}
                                        aria-label={`Filter ${option.label} users`}
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

                        <Button onClick={() => setCreateOpen(true)}>
                            <PlusIcon data-icon="inline-start" />
                            Create user
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-[30rem] xl:w-[38rem]">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchFilter}
                                onChange={(event) => {
                                    table
                                        .getColumn('userSearch')
                                        ?.setFilterValue(
                                            event.target.value || undefined,
                                        );
                                    table.setPageIndex(0);
                                }}
                                placeholder="Search name, email, social, role or status..."
                                className="pl-9"
                                aria-label="Search users"
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
                            value={roleFilter}
                            onValueChange={(value) => {
                                table
                                    .getColumn('role')
                                    ?.setFilterValue(
                                        value === 'all' ? undefined : value,
                                    );
                                table.setPageIndex(0);
                            }}
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-36"
                                aria-label="Role filter"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectGroup>
                                    <SelectItem value="all">
                                        All roles
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        Admin ({roleCounts.admin})
                                    </SelectItem>
                                    <SelectItem value="user">
                                        User ({roleCounts.user})
                                    </SelectItem>
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
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className="align-top"
                                    >
                                        {row.getVisibleCells().map((cell) => (
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
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-28 text-center text-muted-foreground"
                                    >
                                        No users match the current filters.
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

            <UserFormDialog
                key="create-user"
                open={createOpen}
                onOpenChange={setCreateOpen}
                roles={roles}
            />

            {editingUser && (
                <UserFormDialog
                    key={`edit-user-${editingUser.id}`}
                    open={editingUser !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingUser(null);
                        }
                    }}
                    roles={roles}
                    user={editingUser}
                    lockRole={editingUser.id === auth.user?.id}
                />
            )}

            {statusUser && (
                <UserStatusDialog
                    user={statusUser}
                    open={statusUser !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setStatusUser(null);
                        }
                    }}
                />
            )}
        </>
    );
}

function UserFormDialog({
    open,
    onOpenChange,
    roles,
    user,
    lockRole = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: RoleOption[];
    user?: AdminUser;
    lockRole?: boolean;
}) {
    const isEditing = user !== undefined;
    const form = useForm<UserFormData>(
        isEditing ? updateUser(user.id) : store(),
        {
            name: user?.name ?? '',
            email: user?.email ?? '',
            email_confirmation: '',
            role: user?.role ?? 'user',
        },
    );
    const normalizedEmail = form.data.email.trim().toLowerCase();
    const originalEmail = user?.email.toLowerCase() ?? '';
    const emailChanged = isEditing && normalizedEmail !== originalEmail;

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.submit({
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);

                if (!isEditing) {
                    form.reset();
                }
            },
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn('sm:max-w-lg', isEditing && 'sm:max-w-2xl')}
            >
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit user' : 'Create user'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing ? user.email : 'A setup link will be sent.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="admin-user-name">Name</Label>
                        <Input
                            id="admin-user-name"
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            onBlur={() => form.validate('name')}
                            autoComplete="name"
                            required
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="admin-user-email">Email</Label>
                        <Input
                            id="admin-user-email"
                            type="email"
                            value={form.data.email}
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                            onBlur={() => form.validate('email')}
                            autoComplete="email"
                            required
                        />
                        <InputError message={form.errors.email} />
                    </div>

                    {emailChanged && (
                        <div className="grid gap-2">
                            <Label htmlFor="admin-user-email-confirmation">
                                Confirm email
                            </Label>
                            <Input
                                id="admin-user-email-confirmation"
                                type="email"
                                value={form.data.email_confirmation}
                                onChange={(event) =>
                                    form.setData(
                                        'email_confirmation',
                                        event.target.value,
                                    )
                                }
                                onBlur={() => form.validate('email')}
                                autoComplete="off"
                                required
                            />
                            <InputError
                                message={form.errors.email_confirmation}
                            />
                        </div>
                    )}

                    {isEditing && (
                        <Alert>
                            <InfoIcon />
                            <AlertTitle>
                                How social sign-in reconciliation works
                            </AlertTitle>
                            <AlertDescription>
                                <ul className="ml-4 list-disc space-y-1">
                                    <li>
                                        Provider identity already linked: future
                                        sign-ins keep using this user, even if
                                        the account email changes.
                                    </li>
                                    <li>
                                        Verified provider email: if no provider
                                        link exists yet, the normalized email is
                                        matched to an existing user; otherwise a
                                        new social-only user is created.
                                    </li>
                                    <li>
                                        No trusted provider email: the user must
                                        confirm an address with OTP, then that
                                        normalized address is matched or
                                        created.
                                    </li>
                                    <li>
                                        Changing this email: new unlinked
                                        provider logins with the new verified
                                        email reconcile to this user, while
                                        logins still reporting the old email may
                                        match another account or create a
                                        separate one.
                                    </li>
                                    <li>
                                        Email already used: saving is blocked by
                                        the unique email rule.
                                    </li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="admin-user-role">Role</Label>
                        <Select
                            value={form.data.role}
                            disabled={lockRole}
                            onValueChange={(value) => {
                                form.setData('role', value as AdminUserRole);
                                form.validate('role');
                            }}
                        >
                            <SelectTrigger id="admin-user-role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {roles.map((role) => (
                                        <SelectItem
                                            key={role.value}
                                            value={role.value}
                                        >
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.role} />
                    </div>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? (
                                <Spinner data-icon="inline-start" />
                            ) : (
                                <SaveIcon data-icon="inline-start" />
                            )}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function UserStatusDialog({
    user,
    open,
    onOpenChange,
}: {
    user: AdminUser;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const isRestoring = user.is_deactivated;

    function submit() {
        if (isRestoring) {
            router.patch(
                restoreUser(user.id).url,
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => onOpenChange(false),
                },
            );

            return;
        }

        router.delete(destroyUser(user.id).url, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isRestoring ? 'Restore user' : 'Deactivate user'}
                    </DialogTitle>
                    <DialogDescription>{user.email}</DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant={isRestoring ? 'default' : 'destructive'}
                        onClick={submit}
                    >
                        {isRestoring ? (
                            <RotateCcwIcon data-icon="inline-start" />
                        ) : (
                            <UserXIcon data-icon="inline-start" />
                        )}
                        {isRestoring ? 'Restore' : 'Deactivate'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SortableHeader({
    column,
    title,
    className,
}: {
    column: Column<AdminUser, unknown>;
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

function SocialProviderBadges({ providers }: { providers: SocialProvider[] }) {
    if (providers.length === 0) {
        const style = getSocialProviderStyle(null);

        return (
            <Badge
                variant="outline"
                className={cn('uppercase', style.badgeClassName)}
            >
                <SocialProviderIcon provider={null} data-icon="inline-start" />
                LOCAL
            </Badge>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {providers.map((provider) => {
                const style = getSocialProviderStyle(provider.provider);

                return (
                    <Badge
                        key={provider.provider}
                        variant="outline"
                        className={cn('uppercase', style.badgeClassName)}
                    >
                        <SocialProviderIcon
                            provider={provider.provider}
                            data-icon="inline-start"
                        />
                        {provider.label.toUpperCase()}
                    </Badge>
                );
            })}
        </div>
    );
}

function RoleBadge({ role }: { role: AdminUserRole }) {
    const Icon = role === 'admin' ? ShieldCheckIcon : UserIcon;

    return (
        <Badge
            variant={role === 'admin' ? 'destructive' : 'outline'}
            className={cn('uppercase', role === 'user' && 'bg-background')}
        >
            <Icon data-icon="inline-start" />
            {role.toUpperCase()}
        </Badge>
    );
}

function UserStatusBadge({ user }: { user: AdminUser }) {
    if (user.is_deactivated) {
        return (
            <Badge variant="destructive" className="uppercase">
                <UserXIcon data-icon="inline-start" />
                INACTIVE
            </Badge>
        );
    }

    return (
        <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-100 text-emerald-800 uppercase dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-emerald-100"
        >
            <CheckCircle2Icon data-icon="inline-start" />
            ACTIVE
        </Badge>
    );
}

function formatDate(value: string | null) {
    if (!value) {
        return 'Not available';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function dateSortValue(value?: string | null): number {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
}

AdminUsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'All Users',
            href: index(),
        },
    ],
};
