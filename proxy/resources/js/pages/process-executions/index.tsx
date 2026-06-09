import { Head, Link } from '@inertiajs/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { index, show } from '@/routes/process-executions';
import type { ProcessExecutionListItem } from '@/types';

type PaginatedExecutions = {
    data: ProcessExecutionListItem[];
};

export default function ProcessExecutionIndex({ executions }: { executions: PaginatedExecutions }) {
    return (
        <>
            <Head title="Execution History" />

            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-2xl font-semibold">Execution History</h1>

                <div className="flex flex-col gap-3">
                    {executions.data.map((execution) => (
                        <Card key={execution.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle>{execution.processTitle ?? execution.processId}</CardTitle>
                                    <Badge variant="secondary">{execution.status}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">{execution.message}</p>
                                <Button asChild variant="outline">
                                    <Link href={show(execution.id)}>Details</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

ProcessExecutionIndex.layout = {
    breadcrumbs: [
        {
            title: 'Execution History',
            href: index(),
        },
    ],
};
