import { Head } from '@inertiajs/react';

type AdminJob = {
    id: number;
    processId: string;
    processTitle: string | null;
    owner: {
        id: number;
        name: string;
        email: string;
    };
};

type PaginatedJobs = {
    data: AdminJob[];
};

export default function AdminJobsIndex({
    executions,
}: {
    executions: PaginatedJobs;
}) {
    return (
        <>
            <Head title="Admin jobs" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Jobs</h1>
                    <p className="text-sm text-muted-foreground">
                        {executions.data.length} jobs loaded
                    </p>
                </div>
            </div>
        </>
    );
}

AdminJobsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Admin jobs',
            href: '/admin/jobs',
        },
    ],
};
