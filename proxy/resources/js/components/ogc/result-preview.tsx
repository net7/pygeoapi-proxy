import { Download } from 'lucide-react';

import ChartResultPreview from '@/components/ogc/chart-result-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { normalizeCsvPreview } from '@/lib/csv-preview';
import { downloadLabelForMediaType } from '@/lib/ogc-outputs';
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
                    </div>
                    {canDownload ? (
                        <Button asChild variant="outline" size="sm">
                            <a href={download.url([executionId, result.id])}>
                                <Download data-icon="inline-start" />
                                {downloadLabelForMediaType(result.mediaType)}
                            </a>
                        </Button>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent>
                {preview?.kind === 'chart' ? (
                    <ChartResultPreview data={preview.data} />
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

function CsvPreview({ data }: { data: unknown }) {
    const { t } = useTranslation();
    const csv = normalizeCsvPreview(data);

    if (!csv) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('ogc.previewUnavailable')}
            </p>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        {csv.headers.map((cell, index) => (
                            <TableHead key={index}>{cell}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {csv.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex}>{cell}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {csv.truncated ? (
                <p className="text-xs text-muted-foreground">
                    {t('ogc.csvPreviewTruncated')}
                </p>
            ) : null}
        </div>
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
