import 'maplibre-gl/dist/maplibre-gl.css';

import { AlertTriangleIcon, Download } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import {
    buildGeoTiffMapPreview,
    type GeoTiffMapPreview,
} from '@/lib/geotiff-map-preview';
import { cn } from '@/lib/utils';
import { download, previewFile } from '@/routes/jobs/results';
import type { ProcessExecutionResult } from '@/types';

type PreviewState =
    | { status: 'loading' }
    | { status: 'ready'; preview: GeoTiffMapPreview }
    | { status: 'error'; reason: 'unsupported-bounds' | 'unavailable' };

export default function GeoTiffMapResultPreview({
    executionId,
    title,
    description,
    geotiff,
    sld,
}: {
    executionId: number;
    title: string;
    description?: string | null;
    geotiff: ProcessExecutionResult;
    sld: ProcessExecutionResult;
}) {
    const { t } = useTranslation();
    const [state, setState] = useState<PreviewState>({ status: 'loading' });

    useEffect(() => {
        const abortController = new AbortController();

        async function loadPreview() {
            try {
                const [geotiffResponse, sldResponse] = await Promise.all([
                    fetch(previewFile.url([executionId, geotiff.id]), {
                        credentials: 'same-origin',
                        signal: abortController.signal,
                    }),
                    fetch(previewFile.url([executionId, sld.id]), {
                        credentials: 'same-origin',
                        signal: abortController.signal,
                    }),
                ]);

                if (!geotiffResponse.ok || !sldResponse.ok) {
                    setState({ status: 'error', reason: 'unavailable' });
                    return;
                }

                const preview = await buildGeoTiffMapPreview({
                    geotiffBuffer: await geotiffResponse.arrayBuffer(),
                    sldText: await sldResponse.text(),
                    signal: abortController.signal,
                });

                setState({ status: 'ready', preview });
            } catch (error) {
                if (abortController.signal.aborted) {
                    return;
                }

                setState({
                    status: 'error',
                    reason:
                        error instanceof Error &&
                        error.message === 'unsupported-bounds'
                            ? 'unsupported-bounds'
                            : 'unavailable',
                });
            }
        }

        loadPreview();

        return () => abortController.abort();
    }, [executionId, geotiff.id, sld.id]);

    return (
        <Card className="shadow-sm dark:border-border/70 dark:bg-card/95">
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                        <CardTitle>{title}</CardTitle>
                        {description ? (
                            <CardDescription>{description}</CardDescription>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <DownloadButton
                            executionId={executionId}
                            result={geotiff}
                            label={t('ogc.geotiffDownload')}
                        />
                        <DownloadButton
                            executionId={executionId}
                            result={sld}
                            label={t('ogc.sldDownload')}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {state.status === 'loading' ? (
                    <div className="flex h-80 items-center justify-center rounded-md bg-muted/70 text-sm text-muted-foreground ring-1 ring-border/50 dark:bg-muted/40">
                        <Spinner className="mr-2" />
                        {t('ogc.mapPreviewLoading')}
                    </div>
                ) : null}

                {state.status === 'ready' ? (
                    <>
                        <MapLibreCanvasPreview preview={state.preview} />
                        {state.preview.styleWarning ? (
                            <Alert className="dark:border-border/70">
                                <AlertTriangleIcon />
                                <AlertDescription>
                                    {t('ogc.mapStyleFallback')}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </>
                ) : null}

                {state.status === 'error' ? (
                    <Alert className="dark:border-border/70">
                        <AlertTriangleIcon />
                        <AlertDescription>
                            {t(
                                state.reason === 'unsupported-bounds'
                                    ? 'ogc.mapPreviewUnsupportedBounds'
                                    : 'ogc.mapPreviewUnavailable',
                            )}
                        </AlertDescription>
                    </Alert>
                ) : null}
            </CardContent>
        </Card>
    );
}

function DownloadButton({
    executionId,
    result,
    label,
}: {
    executionId: number;
    result: ProcessExecutionResult;
    label: string;
}) {
    const canDownload =
        result.cacheStatus === 'cached' ||
        result.cacheStatus === 'metadata_only';

    if (!canDownload) {
        return null;
    }

    return (
        <Button asChild variant="outline" size="sm">
            <a href={download.url([executionId, result.id])}>
                <Download data-icon="inline-start" />
                {label}
            </a>
        </Button>
    );
}

function MapLibreCanvasPreview({ preview }: { preview: GeoTiffMapPreview }) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const [west, south, east, north] = preview.bounds;
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                version: 8,
                sources: {},
                layers: [
                    {
                        id: 'background',
                        type: 'background',
                        paint: {
                            'background-color': '#f8fafc',
                        },
                    },
                ],
            },
            center: [(west + east) / 2, (south + north) / 2],
            zoom: 10,
            attributionControl: false,
        });

        map.addControl(
            new maplibregl.NavigationControl({ showCompass: false }),
            'top-right',
        );

        map.on('load', () => {
            map.addSource('geotiff-canvas', {
                type: 'canvas',
                canvas: preview.canvas,
                coordinates: preview.coordinates,
                animate: false,
            });
            map.addLayer({
                id: 'geotiff-canvas',
                type: 'raster',
                source: 'geotiff-canvas',
            });
            map.fitBounds(
                [
                    [west, south],
                    [east, north],
                ],
                { padding: 24, duration: 0 },
            );
        });

        return () => map.remove();
    }, [preview]);

    return (
        <div
            ref={containerRef}
            className={cn(
                'h-80 min-h-80 overflow-hidden rounded-md bg-muted ring-1 ring-border/50',
                'dark:bg-muted/40',
            )}
        />
    );
}
