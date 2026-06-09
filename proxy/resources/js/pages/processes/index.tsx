import { Head, Link } from '@inertiajs/react';
import { Cpu, PlayCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { index, show } from '@/routes/processes';
import type { OgcProcessSummary } from '@/types';

export default function ProcessIndex({
    processes,
}: {
    processes: OgcProcessSummary[];
}) {
    return (
        <>
            <Head title="Processes" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold">Processes</h1>
                        <p className="text-sm text-muted-foreground">
                            Available OGC API processes from Geo-INQUIRE.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {processes.map((process) => (
                        <Card key={process.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>
                                            {process.title ?? process.id}
                                        </CardTitle>
                                        <CardDescription>
                                            {process.id}
                                        </CardDescription>
                                    </div>
                                    <Cpu
                                        className="text-muted-foreground"
                                        data-icon="inline-start"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <p className="line-clamp-4 text-sm text-muted-foreground">
                                    {process.description}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {process.jobControlOptions?.map(
                                        (option) => (
                                            <Badge
                                                key={option}
                                                variant="secondary"
                                            >
                                                {option}
                                            </Badge>
                                        ),
                                    )}
                                </div>
                                <Button asChild>
                                    <Link href={show(process.id)}>
                                        <PlayCircle data-icon="inline-start" />
                                        Open
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

ProcessIndex.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            href: index(),
        },
    ],
};
