import { Head } from '@inertiajs/react';

type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    jobs_count: number;
    is_deactivated: boolean;
};

type PaginatedUsers = {
    data: AdminUser[];
};

export default function AdminUsersIndex({ users }: { users: PaginatedUsers }) {
    return (
        <>
            <Head title="Admin users" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Users</h1>
                    <p className="text-sm text-muted-foreground">
                        {users.data.length} users loaded
                    </p>
                </div>
            </div>
        </>
    );
}

AdminUsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Admin users',
            href: '/admin/users',
        },
    ],
};
