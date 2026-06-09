import { Head, Link } from '@inertiajs/react';

import { index } from '@/routes/process-executions';
import { download } from '@/routes/process-executions/results';

type ExecutionResult = {
    id: number;
    outputId: string;
    title?: string | null;
    description?: string | null;
    mediaType?: string | null;
    cacheStatus: string;
};

type ExecutionDetail = {
    id: number;
    processId: string;
    processTitle?: string | null;
    processVersion?: string | null;
    status: string;
    progress?: number | null;
    message?: string | null;
    results: ExecutionResult[];
};

export default function ProcessExecutionsShow({ execution }: { execution: ExecutionDetail }) {
    return (
        <>
            <Head title={execution.processTitle ?? execution.processId} />

            <main className="flex h-full flex-1 flex-col gap-5 p-4">
                <header className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold tracking-normal">
                            {execution.processTitle ?? execution.processId}
                        </h1>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {execution.status}
                        </span>
                    </div>
                    {execution.message ? (
                        <p className="max-w-4xl text-sm text-muted-foreground">{execution.message}</p>
                    ) : null}
                </header>

                <section className="grid gap-3">
                    <h2 className="text-sm font-medium uppercase text-muted-foreground">Outputs</h2>
                    {execution.results.map((result) => (
                        <div key={result.id} className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-medium">{result.title ?? result.outputId}</h3>
                                    <p className="mt-1 font-mono text-xs text-muted-foreground">{result.outputId}</p>
                                </div>
                                <Link
                                    href={download({ processExecution: execution.id, result: result.id })}
                                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                >
                                    Download
                                </Link>
                            </div>
                            {result.description ? (
                                <p className="mt-3 text-sm text-muted-foreground">{result.description}</p>
                            ) : null}
                        </div>
                    ))}
                </section>
            </main>
        </>
    );
}

ProcessExecutionsShow.layout = {
    breadcrumbs: [
        {
            title: 'Process Executions',
            href: index(),
        },
    ],
};
