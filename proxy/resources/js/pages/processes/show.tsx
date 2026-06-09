import { Head } from '@inertiajs/react';

import { index } from '@/routes/processes';

type ProcessDescription = {
    id: string;
    title?: string;
    description?: string;
    version?: string;
};

type FormSchema = {
    fields?: Record<string, { title?: string; type?: string; required?: boolean }>;
};

export default function ProcessesShow({
    process,
    formSchema,
}: {
    process: ProcessDescription;
    formSchema: FormSchema;
}) {
    const fields = Object.entries(formSchema.fields ?? {});

    return (
        <>
            <Head title={process.title ?? process.id} />

            <main className="flex h-full flex-1 flex-col gap-5 p-4">
                <header className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold tracking-normal">{process.title ?? process.id}</h1>
                        {process.version ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {process.version}
                            </span>
                        ) : null}
                    </div>
                    {process.description ? (
                        <p className="max-w-4xl text-sm text-muted-foreground">{process.description}</p>
                    ) : null}
                </header>

                <section className="grid gap-3">
                    <h2 className="text-sm font-medium uppercase text-muted-foreground">Inputs</h2>
                    {fields.map(([id, field]) => (
                        <div key={id} className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-medium">{field.title ?? id}</h3>
                                {field.required ? (
                                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        required
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
                        </div>
                    ))}
                </section>
            </main>
        </>
    );
}

ProcessesShow.layout = {
    breadcrumbs: [
        {
            title: 'OGC Processes',
            href: index(),
        },
    ],
};
