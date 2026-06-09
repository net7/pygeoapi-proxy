import { Head, Link } from '@inertiajs/react';

import { index, show } from '@/routes/process-executions';

type ExecutionSummary = {
    id: number;
    processId: string;
    processTitle?: string;
    status: string;
    progress?: number | null;
    message?: string | null;
    createdAt?: string | null;
};

type PaginatedExecutions = {
    data: ExecutionSummary[];
};

export default function ProcessExecutionsIndex({ executions }: { executions: PaginatedExecutions }) {
    return (
        <>
            <Head title="Process Executions" />

            <main className="flex h-full flex-1 flex-col gap-4 p-4">
                <header className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-normal">Process Executions</h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">Storico locale delle richieste OGC.</p>
                </header>

                <div className="grid gap-3">
                    {executions.data.map((execution) => (
                        <Link
                            key={execution.id}
                            href={show(execution.id)}
                            className="rounded-lg border border-sidebar-border/70 p-4 transition-colors hover:bg-muted/40 dark:border-sidebar-border"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-medium">{execution.processTitle ?? execution.processId}</h2>
                                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                    {execution.status}
                                </span>
                            </div>
                            {execution.message ? (
                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{execution.message}</p>
                            ) : null}
                        </Link>
                    ))}
                </div>
            </main>
        </>
    );
}

ProcessExecutionsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Process Executions',
            href: index(),
        },
    ],
};
