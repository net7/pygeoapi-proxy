import { Head, Link } from '@inertiajs/react';

import { index, show } from '@/routes/processes';

type ProcessSummary = {
    id: string;
    title?: string;
    description?: string;
    version?: string;
};

export default function ProcessesIndex({ processes }: { processes: ProcessSummary[] }) {
    return (
        <>
            <Head title="OGC Processes" />

            <main className="flex h-full flex-1 flex-col gap-4 p-4">
                <header className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-normal">OGC Processes</h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                        Processi disponibili dal servizio Geo-INQUIRE.
                    </p>
                </header>

                <div className="grid gap-3">
                    {processes.map((process) => (
                        <Link
                            key={process.id}
                            href={show(process.id)}
                            className="rounded-lg border border-sidebar-border/70 p-4 transition-colors hover:bg-muted/40 dark:border-sidebar-border"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-medium">{process.title ?? process.id}</h2>
                                {process.version ? (
                                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        {process.version}
                                    </span>
                                ) : null}
                            </div>
                            {process.description ? (
                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                    {process.description}
                                </p>
                            ) : null}
                        </Link>
                    ))}
                </div>
            </main>
        </>
    );
}

ProcessesIndex.layout = {
    breadcrumbs: [
        {
            title: 'OGC Processes',
            href: index(),
        },
    ],
};
