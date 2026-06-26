import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { download } from '@/routes/jobs/results';
import type { ProcessExecutionResult } from '@/types';

export default function ResultPreview({
    executionId,
    result,
}: {
    executionId: number;
    result: ProcessExecutionResult;
}) {
    const { t } = useTranslation();
    const preview = result.preview;
    const canDownload =
        result.cacheStatus === 'cached' ||
        result.cacheStatus === 'metadata_only';

    return (
        <Card className="shadow-sm dark:border-border/70 dark:bg-card/95">
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{result.title ?? result.outputId}</CardTitle>
                        <CardDescription>{result.mediaType}</CardDescription>
                    </div>
                    {canDownload ? (
                        <Button asChild variant="outline">
                            <a href={download.url([executionId, result.id])}>
                                <Download data-icon="inline-start" />
                                {t('common.download')}
                            </a>
                        </Button>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent>
                {preview?.kind === 'chart' ? (
                    <ChartPreview data={preview.data} />
                ) : null}
                {preview?.kind === 'csv' ? (
                    <CsvPreview data={preview.data} />
                ) : null}
                {preview?.kind === 'text' ? (
                    <TextPreview data={preview.data} />
                ) : null}
                {preview?.kind === 'json' ? (
                    <JsonPreview data={preview.data} />
                ) : null}
                {preview?.kind === 'binary' ? (
                    <p className="text-sm text-muted-foreground">
                        {t('ogc.previewUnavailableMedia')}
                    </p>
                ) : null}
                {!preview ? (
                    <p className="text-sm text-muted-foreground">
                        {t('ogc.previewUnavailable')}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}

function ChartPreview({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs ring-1 ring-border/50 dark:bg-muted/50 dark:text-foreground">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}

function CsvPreview({ data }: { data: unknown }) {
    const rows = String(data ?? '')
        .split('\n')
        .filter(Boolean)
        .slice(0, 20)
        .map((row) => row.split(','));

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {rows[0]?.map((cell, index) => (
                        <TableHead key={index}>{cell}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.slice(1).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function TextPreview({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs ring-1 ring-border/50 dark:bg-muted/50 dark:text-foreground">
            {String(data ?? '')}
        </pre>
    );
}

function JsonPreview({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs ring-1 ring-border/50 dark:bg-muted/50 dark:text-foreground">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}
