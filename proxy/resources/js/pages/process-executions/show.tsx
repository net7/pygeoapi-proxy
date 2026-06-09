import { Head } from '@inertiajs/react';

import ResultPreview from '@/components/ogc/result-preview';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">
                            {execution.processTitle ?? execution.processId}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Execution #{execution.id}
                        </p>
                    </div>
                    <Badge variant="secondary">{execution.status}</Badge>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Request Payload</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                            {JSON.stringify(execution.requestPayload, null, 2)}
                        </pre>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-3">
                    {execution.results.map((result) => (
                        <ResultPreview
                            key={result.id}
                            executionId={execution.id}
                            result={result}
                        />
                    ))}
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
