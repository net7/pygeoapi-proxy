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
    UserCheckIcon,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';
import type { TranslationKey } from '@/lib/i18n/translation';
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

type Translate = ReturnType<typeof useTranslation>['t'];

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
    avatar: string | null;
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

const columnLabelKeys: Record<string, TranslationKey> = {
    user: 'common.user',
    role: 'common.role',
    socialProviders: 'admin.registeredWith',
    status: 'common.status',
    jobs_count: 'admin.userJobs',
    created_at: 'jobs.created',
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
    const { locale, t } = useTranslation();
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
                    <SortableHeader column={column} titleKey="common.user" />
                ),
                cell: ({ row }) => <AdminUserIdentity user={row.original} />,
            },
            {
                accessorKey: 'role',
                header: ({ column }) => (
                    <SortableHeader column={column} titleKey="common.role" />
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
                    <SortableHeader
                        column={column}
                        titleKey="admin.registeredWith"
                    />
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
                    <SortableHeader column={column} titleKey="common.status" />
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
                        titleKey="admin.userJobs"
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
                    <SortableHeader column={column} titleKey="jobs.created" />
                ),
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {formatDate(
                            row.original.created_at,
                            locale,
                            t('common.notAvailable'),
                        )}
                    </span>
                ),
                sortingFn: (first, second) =>
                    dateSortValue(first.original.created_at) -
                    dateSortValue(second.original.created_at),
            },
            {
                id: 'actions',
                header: () => (
                    <span className="sr-only">{t('jobs.actions')}</span>
                ),
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
                            {user.is_deactivated
                                ? t('admin.restore')
                                : t('admin.deactivate').toUpperCase()}
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
                                    {t('admin.viewUserJobs')}
                                </Link>
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingUser(user)}
                            >
                                <PencilIcon data-icon="inline-start" />
                                {t('common.edit')}
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
                                                {t('admin.actionUnavailable')}
                                            </PopoverTitle>
                                            <PopoverDescription>
                                                {t(
                                                    'admin.userSelfStatusUnavailable',
                                                )}
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
        [auth.user?.id, locale, t],
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
            <Head title={t('admin.allUsers')} />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            {t('admin.administration')}
                        </p>
                        <h1 className="text-2xl font-semibold">
                            {t('admin.allUsers')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('admin.shownUsers', {
                                shown: filteredRowsCount,
                                total: users.data.length,
                            })}
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
                                    label: t('jobs.all'),
                                    count: users.data.length,
                                    icon: ListFilterIcon,
                                },
                                {
                                    value: 'active',
                                    label: t('admin.statusActive'),
                                    count: statusCounts.active,
                                    icon: CheckCircle2Icon,
                                },
                                {
                                    value: 'inactive',
                                    label: t('admin.statusInactive'),
                                    count: statusCounts.inactive,
                                    icon: UserXIcon,
                                },
                            ].map((option) => {
                                const Icon = option.icon;

                                return (
                                    <ToggleGroupItem
                                        key={option.value}
                                        value={option.value}
                                        aria-label={t('admin.filterUsers', {
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

                        <Button onClick={() => setCreateOpen(true)}>
                            <PlusIcon data-icon="inline-start" />
                            {t('admin.createUser')}
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
                                placeholder={t('admin.searchUsersPlaceholder')}
                                className="pl-9"
                                aria-label={t('admin.searchUsers')}
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
                                aria-label={t('admin.roleFilter')}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectGroup>
                                    <SelectItem value="all">
                                        {t('admin.allRoles')}
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        {roleLabel('admin', t)} (
                                        {roleCounts.admin})
                                    </SelectItem>
                                    <SelectItem value="user">
                                        {roleLabel('user', t)} (
                                        {roleCounts.user})
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
                                        {t('admin.usersNoMatch')}
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
    const { t } = useTranslation();
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
    const headerIconClassName = isEditing
        ? 'bg-muted text-muted-foreground'
        : 'bg-primary/10 text-primary';

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
                className={cn(
                    'overflow-hidden p-0 sm:max-w-lg',
                    isEditing && 'sm:max-w-2xl',
                )}
            >
                <DialogHeader className="border-b bg-muted/30 px-6 py-5 pr-12">
                    <div className="flex items-start gap-3 text-left">
                        <span
                            className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                                headerIconClassName,
                            )}
                        >
                            {isEditing ? (
                                <InfoIcon className="size-5" />
                            ) : (
                                <PlusIcon className="size-5" />
                            )}
                        </span>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle>
                                {isEditing
                                    ? t('admin.editUserDetails')
                                    : t('admin.createUser')}
                            </DialogTitle>
                            <DialogDescription className="break-words">
                                {isEditing
                                    ? user.email
                                    : t('admin.createUserDescription')}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={submit} className="flex flex-col gap-5">
                    <div className="grid gap-4 px-6 pt-5 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="admin-user-name">
                                {t('common.name')}
                            </Label>
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
                            <Label htmlFor="admin-user-email">
                                {t('common.email')}
                            </Label>
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

                        <div className="grid gap-2">
                            <Label htmlFor="admin-user-role">
                                {t('common.role')}
                            </Label>
                            <Select
                                value={form.data.role}
                                disabled={lockRole}
                                onValueChange={(value) => {
                                    form.setData(
                                        'role',
                                        value as AdminUserRole,
                                    );
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
                                                {roleLabel(role.value, t)}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.role} />
                        </div>

                        {emailChanged && (
                            <div className="grid gap-2">
                                <Label htmlFor="admin-user-email-confirmation">
                                    {t('admin.confirmEmail')}
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
                    </div>

                    {isEditing && (
                        <div className="px-6">
                            <Alert className="w-full max-w-full min-w-0 border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100 [&>svg]:size-5">
                                <InfoIcon className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-300" />
                                <AlertTitle>
                                    {t('admin.socialReconciliation')}
                                </AlertTitle>
                                <AlertDescription className="min-w-0 text-emerald-900/80 dark:text-emerald-100/80">
                                    <ul className="min-w-0 list-disc space-y-1 pl-4 break-words">
                                        <li>{t('admin.providerLinked')}</li>
                                        <li>{t('admin.providerEmail')}</li>
                                        <li>
                                            {t('admin.noTrustedProviderEmail')}
                                        </li>
                                        <li>{t('admin.emailChanged')}</li>
                                        <li>{t('admin.emailAlreadyUsed')}</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                {t('common.cancel')}
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? (
                                <Spinner data-icon="inline-start" />
                            ) : (
                                <SaveIcon data-icon="inline-start" />
                            )}
                            {t('common.save')}
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
    const { t } = useTranslation();
    const isRestoring = user.is_deactivated;
    const StatusIcon = isRestoring ? UserCheckIcon : UserXIcon;
    const statusTone = isRestoring
        ? {
              panelClassName:
                  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100',
              iconClassName:
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
              title: t('admin.activateTitle'),
              description: t('admin.statusRestoreDescription'),
          }
        : {
              panelClassName:
                  'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100',
              iconClassName:
                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
              title: t('admin.deactivateTitle'),
              description: t('admin.statusDeactivateDescription'),
          };

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
            <DialogContent className="overflow-hidden p-0 sm:max-w-md">
                <DialogHeader className="px-6 pt-6 pr-12 text-left">
                    <DialogTitle>
                        {isRestoring
                            ? t('admin.activateUser')
                            : t('admin.deactivateUser')}
                    </DialogTitle>
                    <DialogDescription className="space-y-0.5 break-words">
                        <span className="block font-semibold text-foreground">
                            {user.name}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground italic">
                            {user.email}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div
                    className={cn(
                        'mx-6 rounded-lg border p-4',
                        statusTone.panelClassName,
                    )}
                >
                    <div className="flex items-start gap-3">
                        <span
                            className={cn(
                                'flex size-11 shrink-0 items-center justify-center rounded-lg',
                                statusTone.iconClassName,
                            )}
                        >
                            <StatusIcon
                                data-icon="dialog-status"
                                className="size-5"
                            />
                        </span>
                        <div className="min-w-0 space-y-1">
                            <p className="font-medium">{statusTone.title}</p>
                            <p className="text-sm opacity-80">
                                {statusTone.description}
                            </p>
                            <div className="mt-3 space-y-1 rounded-md border border-current/15 bg-white/55 px-3 py-2 dark:bg-black/10">
                                <p
                                    data-slot="status-user-name"
                                    className="text-sm font-semibold break-words"
                                >
                                    {user.name}
                                </p>
                                <p
                                    data-slot="status-user-email"
                                    className="font-mono text-xs break-all italic opacity-75"
                                >
                                    {user.email}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            {t('common.cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant={isRestoring ? 'default' : 'destructive'}
                        onClick={submit}
                    >
                        {isRestoring ? (
                            <UserCheckIcon data-icon="inline-start" />
                        ) : (
                            <UserXIcon data-icon="inline-start" />
                        )}
                        {isRestoring
                            ? t('admin.activate')
                            : t('admin.deactivate')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SortableHeader({
    column,
    titleKey,
    className,
}: {
    column: Column<AdminUser, unknown>;
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

function AdminUserIdentity({
    user,
}: {
    user: Pick<AdminUser, 'name' | 'email' | 'avatar'>;
}) {
    const getInitials = useInitials();

    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 rounded-full">
                <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                <AvatarFallback className="rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                </span>
            </div>
        </div>
    );
}

function SocialProviderBadges({ providers }: { providers: SocialProvider[] }) {
    const { t } = useTranslation();

    if (providers.length === 0) {
        const style = getSocialProviderStyle(null);

        return (
            <Badge
                variant="outline"
                className={cn('uppercase', style.badgeClassName)}
            >
                <SocialProviderIcon provider={null} data-icon="inline-start" />
                {t('admin.local')}
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
    const { t } = useTranslation();
    const Icon = role === 'admin' ? ShieldCheckIcon : UserIcon;

    return (
        <Badge
            variant={role === 'admin' ? 'destructive' : 'outline'}
            className={cn('uppercase', role === 'user' && 'bg-background')}
        >
            <Icon data-icon="inline-start" />
            {roleLabel(role, t).toUpperCase()}
        </Badge>
    );
}

function UserStatusBadge({ user }: { user: AdminUser }) {
    const { t } = useTranslation();

    if (user.is_deactivated) {
        return (
            <Badge variant="destructive" className="uppercase">
                <UserXIcon data-icon="inline-start" />
                {t('admin.statusInactive')}
            </Badge>
        );
    }

    return (
        <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-100 text-emerald-800 uppercase dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-emerald-100"
        >
            <CheckCircle2Icon data-icon="inline-start" />
            {t('admin.statusActive')}
        </Badge>
    );
}

function formatDate(value: string | null, locale: string, unavailable: string) {
    if (!value) {
        return unavailable;
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function roleLabel(role: AdminUserRole, t: Translate): string {
    return role === 'admin' ? t('admin.roleAdmin') : t('common.user');
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
            titleKey: 'admin.allUsers',
            href: index(),
        },
    ],
};
