import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    PencilIcon,
    PlusIcon,
    RotateCcwIcon,
    SaveIcon,
    SearchIcon,
    UserXIcon,
    XIcon,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
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
import {
    destroy as destroyUser,
    index,
    restore as restoreUser,
    store,
    update as updateUser,
} from '@/routes/admin/users';
import type { Auth } from '@/types';

type AdminUserRole = 'user' | 'admin';

type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: AdminUserRole;
    is_admin: boolean;
    is_deactivated: boolean;
    deactivated_at: string | null;
    jobs_count: number;
    created_at: string | null;
};

type RoleOption = {
    value: AdminUserRole;
    label: string;
};

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type PaginatedUsers = {
    data: AdminUser[];
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

type UserFormData = {
    name: string;
    email: string;
    role: AdminUserRole;
};

type PageProps = {
    auth: Auth;
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
    const [search, setSearch] = useState(filters.search ?? '');
    const [createOpen, setCreateOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [statusUser, setStatusUser] = useState<AdminUser | null>(null);
    const isFiltering = filters.search !== '';

    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        router.get(
            index.url({
                query: search ? { search } : {},
            }),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    }

    function resetSearch() {
        setSearch('');

        router.get(
            index.url(),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    }

    return (
        <>
            <Head title="Admin users" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            Admin
                        </p>
                        <h1 className="text-2xl font-semibold">Users</h1>
                        <p className="text-sm text-muted-foreground">
                            {users.from ?? 0}-{users.to ?? 0} of {users.total}
                        </p>
                    </div>

                    <Button onClick={() => setCreateOpen(true)}>
                        <PlusIcon data-icon="inline-start" />
                        Create user
                    </Button>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <form
                        onSubmit={submitSearch}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                        <div className="relative w-full sm:w-[28rem]">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search users..."
                                className="pl-9"
                                aria-label="Search users"
                            />
                        </div>

                        <Button type="submit" variant="outline" size="sm">
                            <SearchIcon data-icon="inline-start" />
                            Search
                        </Button>

                        {isFiltering && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={resetSearch}
                            >
                                <XIcon data-icon="inline-start" />
                                Reset
                            </Button>
                        )}
                    </form>
                </div>

                <div className="overflow-hidden rounded-md border bg-card shadow-sm dark:border-border/70 dark:bg-card/95">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-56">User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Jobs
                                </TableHead>
                                <TableHead className="min-w-36">
                                    Created
                                </TableHead>
                                <TableHead className="w-56 text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.data.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.data.map((user) => {
                                    const isSelf = user.id === auth.user?.id;

                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate font-medium">
                                                        {user.name}
                                                    </span>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {user.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <RoleBadge role={user.role} />
                                            </TableCell>
                                            <TableCell>
                                                <UserStatusBadge user={user} />
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {user.jobs_count}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDate(user.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setEditingUser(user)
                                                        }
                                                    >
                                                        <PencilIcon data-icon="inline-start" />
                                                        Edit
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isSelf}
                                                        onClick={() =>
                                                            setStatusUser(user)
                                                        }
                                                    >
                                                        {user.is_deactivated ? (
                                                            <RotateCcwIcon data-icon="inline-start" />
                                                        ) : (
                                                            <UserXIcon data-icon="inline-start" />
                                                        )}
                                                        {user.is_deactivated
                                                            ? 'Restore'
                                                            : 'Deactivate'}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pagination links={users.links} />
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
            role: user?.role ?? 'user',
        },
    );

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
            <DialogContent className="sm:max-w-lg">
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
                                {roles.map((role) => (
                                    <SelectItem
                                        key={role.value}
                                        value={role.value}
                                    >
                                        {role.label}
                                    </SelectItem>
                                ))}
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

function RoleBadge({ role }: { role: AdminUserRole }) {
    return (
        <Badge
            variant={role === 'admin' ? 'default' : 'secondary'}
            className="uppercase"
        >
            {role}
        </Badge>
    );
}

function UserStatusBadge({ user }: { user: AdminUser }) {
    if (user.is_deactivated) {
        return <Badge variant="destructive">Inactive</Badge>;
    }

    return (
        <Badge variant="outline">
            <CheckCircle2Icon data-icon="inline-start" />
            Active
        </Badge>
    );
}

function Pagination({ links }: { links: PaginationLink[] }) {
    const visibleLinks = links.filter(
        (link) => link.url !== null || link.active,
    );

    if (visibleLinks.length <= 1) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {visibleLinks.map((link, index) =>
                link.url ? (
                    <Button
                        key={`${link.label}-${index}`}
                        asChild
                        size="sm"
                        variant={link.active ? 'default' : 'outline'}
                    >
                        <Link href={link.url} preserveScroll>
                            {paginationLabel(link.label)}
                        </Link>
                    </Button>
                ) : (
                    <Button
                        key={`${link.label}-${index}`}
                        size="sm"
                        variant="outline"
                        disabled
                    >
                        {paginationLabel(link.label)}
                    </Button>
                ),
            )}
        </div>
    );
}

function paginationLabel(label: string) {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .replace('Previous', 'Prev')
        .trim();
}

function formatDate(value: string | null) {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

AdminUsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Admin users',
            href: index(),
        },
    ],
};
