import { ChevronDownIcon, Download, FileTextIcon } from 'lucide-react';

import ChartResultPreview from '@/components/ogc/chart-result-preview';
import RawPayloadBlock from '@/components/ogc/raw-payload-block';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
    const copyLabel = result.title ?? result.outputId;

    return (
        <Collapsible defaultOpen asChild>
            <Card className="shadow-sm dark:border-border/70 dark:bg-card/95">
                <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <CardTitle className="flex min-w-0 items-center gap-2">
                                <FileTextIcon
                                    aria-hidden="true"
                                    className="size-4 shrink-0 text-muted-foreground"
                                />
                                <CollapsibleTrigger className="flex min-w-0 items-center gap-1 rounded-sm text-left ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]>svg]:rotate-180">
                                    <span className="min-w-0 truncate">
                                        {result.title ?? result.outputId}
                                    </span>
                                    <ChevronDownIcon
                                        aria-hidden="true"
                                        className="size-4 shrink-0 text-muted-foreground transition-transform"
                                    />
                                </CollapsibleTrigger>
                            </CardTitle>
                        </div>
                        {canDownload ? (
                            <Button asChild variant="outline" size="sm">
                                <a
                                    href={download.url([
                                        executionId,
                                        result.id,
                                    ])}
                                >
                                    <Download data-icon="inline-start" />
                                    {downloadLabelForMediaType(
                                        result.mediaType,
                                    )}
                                </a>
                            </Button>
                        ) : null}
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="min-h-96">
                        {preview?.kind === 'chart' ? (
                            <ChartResultPreview
                                data={preview.data}
                                copyLabel={result.title ?? result.outputId}
                            />
                        ) : null}
                        {preview?.kind === 'csv' ? (
                            <CsvPreview
                                data={preview.data}
                                copyLabel={copyLabel}
                            />
                        ) : null}
                        {preview?.kind === 'text' ? (
                            <TextPreview
                                data={preview.data}
                                copyLabel={copyLabel}
                            />
                        ) : null}
                        {preview?.kind === 'json' ? (
                            <JsonPreview
                                data={preview.data}
                                copyLabel={copyLabel}
                            />
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
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function CsvPreview({ data, copyLabel }: { data: unknown; copyLabel: string }) {
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
        <RawPayloadBlock data={data} kind="csv" copyLabel={copyLabel}>
            <div className="flex min-h-96 min-w-0 flex-col gap-2 overflow-auto">
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
                                    <TableCell key={cellIndex}>
                                        {cell}
                                    </TableCell>
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
        </RawPayloadBlock>
    );
}

function TextPreview({
    data,
    copyLabel,
}: {
    data: unknown;
    copyLabel: string;
}) {
    return <RawPayloadBlock data={data} kind="text" copyLabel={copyLabel} />;
}

function JsonPreview({
    data,
    copyLabel,
}: {
    data: unknown;
    copyLabel: string;
}) {
    return <RawPayloadBlock data={data} kind="json" copyLabel={copyLabel} />;
}
