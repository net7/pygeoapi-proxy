import { Head } from '@inertiajs/react';

import ResultPreview from '@/components/ogc/result-preview';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { index } from '@/routes/process-executions';
import type { ProcessExecutionDetail } from '@/types';

export default function ProcessExecutionShow({
    execution,
}: {
    execution: ProcessExecutionDetail;
}) {
    return (
        <>
            <Head title={`Execution ${execution.id}`} />

            <div className="flex min-w-0 flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className="text-2xl font-semibold">
                            {execution.processTitle ?? execution.processId}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Execution #{execution.id}
                        </p>
                    </div>
                    <Badge variant="secondary">{execution.status}</Badge>
                </div>

                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
                    <section className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <h2 className="text-lg font-semibold">Results</h2>
                            <p className="text-sm text-muted-foreground">
                                {execution.results.length} output
                                {execution.results.length === 1 ? '' : 's'}
                            </p>
                        </div>

                        {execution.results.length > 0 ? (
                            <div className="flex min-w-0 flex-col gap-3">
                                {execution.results.map((result) => (
                                    <ResultPreview
                                        key={result.id}
                                        executionId={execution.id}
                                        result={result}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle>No results yet</CardTitle>
                                    <CardDescription>
                                        The execution has not produced stored
                                        outputs.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </section>

                    <aside className="min-w-0 xl:sticky xl:top-4">
                        <Card className="min-w-0">
                            <CardHeader>
                                <CardTitle>Request Payload</CardTitle>
                                <CardDescription>
                                    Submitted inputs and output preferences.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <pre className="max-h-[calc(100vh-14rem)] overflow-auto rounded-md bg-muted p-3 text-xs">
                                    {JSON.stringify(
                                        execution.requestPayload,
                                        null,
                                        2,
                                    )}
                                </pre>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}

ProcessExecutionShow.layout = {
    breadcrumbs: [
        {
            title: 'Execution History',
            href: index(),
        },
    ],
};
