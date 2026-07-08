import 'maplibre-gl/dist/maplibre-gl.css';

import { usePage } from '@inertiajs/react';
import { AlertTriangleIcon, Download, LocateFixedIcon } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type {
    ControlPosition,
    IControl,
    RasterSourceSpecification,
} from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { download, mapTile } from '@/routes/jobs/results';
import type { ProcessExecutionResult } from '@/types';

const worldBasemapSource: RasterSourceSpecification = {
    type: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
};

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
    sld: ProcessExecutionResult | null;
}) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const mapLayer = geotiff.mapLayer;
    const isPublishedWms =
        mapLayer?.type === 'wms' &&
        mapLayer.status === 'published' &&
        mapLayer.name !== null;
    const canViewMapLayerWarning = auth.user?.is_admin === true;

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
                {isPublishedWms && canViewMapLayerWarning && mapLayer.warning ? (
                    <MapLayerWarningAlert warning={mapLayer.warning} />
                ) : null}
                {isPublishedWms ? (
                    <MapLibreWmsPreview
                        executionId={executionId}
                        geotiff={geotiff}
                    />
                ) : (
                    <MapLayerStatusAlert result={geotiff} />
                )}
            </CardContent>
        </Card>
    );
}

function MapLayerWarningAlert({
    warning,
}: {
    warning: NonNullable<ProcessExecutionResult['mapLayer']['warning']>;
}) {
    const { t } = useTranslation();
    const message =
        warning === 'hillshade_without_color_map'
            ? t('ogc.mapLayerHillshadeWarning')
            : null;

    if (!message) {
        return null;
    }

    return (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-300">
            <AlertTriangleIcon />
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}

function DownloadButton({
    executionId,
    result,
    label,
}: {
    executionId: number;
    result: ProcessExecutionResult | null;
    label: string;
}) {
    const canDownload =
        result !== null &&
        (result.cacheStatus === 'cached' ||
            result.cacheStatus === 'metadata_only');

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

function MapLayerStatusAlert({ result }: { result: ProcessExecutionResult }) {
    const { t } = useTranslation();
    const status = result.mapLayer?.status;
    const message =
        status === 'pending' || status === 'publishing'
            ? t('ogc.mapLayerPreparing')
            : status === 'failed'
              ? t('ogc.mapLayerUnavailable')
              : t('ogc.mapLayerUnpublished');

    return (
        <Alert className="dark:border-border/70">
            <AlertTriangleIcon />
            <AlertDescription>
                <span>{message}</span>
                {status === 'failed' && result.mapLayer?.error ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                        {result.mapLayer.error}
                    </span>
                ) : null}
            </AlertDescription>
        </Alert>
    );
}

function MapLibreWmsPreview({
    executionId,
    geotiff,
}: {
    executionId: number;
    geotiff: ProcessExecutionResult;
}) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const bounds = useMemo(
        () => validBounds(geotiff.mapLayer?.bounds),
        [geotiff.mapLayer?.bounds],
    );
    const recenterMapLabel = t('ogc.recenterMap');
    const tileTemplate = useMemo(() => {
        const tileUrl = mapTile.url([executionId, geotiff.id]);
        const separator = tileUrl.includes('?') ? '&' : '?';

        return `${tileUrl}${separator}bbox={bbox-epsg-3857}&width=256&height=256`;
    }, [executionId, geotiff.id]);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                version: 8,
                sources: {
                    openstreetmap: worldBasemapSource,
                },
                layers: [
                    {
                        id: 'background',
                        type: 'background',
                        paint: {
                            'background-color': '#f8fafc',
                        },
                    },
                    {
                        id: 'world-basemap',
                        type: 'raster',
                        source: 'openstreetmap',
                        paint: {
                            'raster-opacity': 0.9,
                        },
                    },
                ],
            },
            center: bounds ? boundsCenter(bounds) : [0, 20],
            zoom: bounds ? 8 : 1.5,
            attributionControl: { compact: true },
        });

        map.addControl(
            new maplibregl.NavigationControl({ showCompass: false }),
            'top-right',
        );

        if (bounds) {
            map.addControl(new RecenterBoundsControl(recenterMapLabel, bounds), 'top-left');
        }

        map.on('load', () => {
            map.addSource('geotiff-wms', {
                type: 'raster',
                tiles: [tileTemplate],
                tileSize: 256,
            });
            map.addLayer({
                id: 'geotiff-wms-layer',
                type: 'raster',
                source: 'geotiff-wms',
                paint: {
                    'raster-opacity': 0.82,
                    'raster-resampling': 'linear',
                },
            });

            if (bounds) {
                fitMapToBounds(map, bounds, 0);
            }
        });

        return () => {
            map.remove();
        };
    }, [bounds, recenterMapLabel, tileTemplate]);

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

class RecenterBoundsControl implements IControl {
    private container: HTMLDivElement | null = null;

    private button: HTMLButtonElement | null = null;

    private iconRoot: Root | null = null;

    private map: maplibregl.Map | null = null;

    public constructor(
        private readonly label: string,
        private readonly bounds: [number, number, number, number],
    ) {}

    public onAdd(map: maplibregl.Map): HTMLElement {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'maplibregl-ctrl-icon';
        this.button.title = this.label;
        this.button.setAttribute('aria-label', this.label);
        this.button.style.display = 'flex';
        this.button.style.alignItems = 'center';
        this.button.style.justifyContent = 'center';
        this.button.addEventListener('click', this.recenter);

        this.iconRoot = createRoot(this.button);
        this.iconRoot.render(
            <LocateFixedIcon aria-hidden="true" size={18} strokeWidth={2.25} />,
        );

        this.container.appendChild(this.button);

        return this.container;
    }

    public onRemove(): void {
        this.button?.removeEventListener('click', this.recenter);
        this.iconRoot?.unmount();
        this.container?.remove();
        this.map = null;
        this.button = null;
        this.container = null;
        this.iconRoot = null;
    }

    public getDefaultPosition(): ControlPosition {
        return 'top-left';
    }

    private recenter = (): void => {
        if (!this.map) {
            return;
        }

        fitMapToBounds(this.map, this.bounds, 350);
    };
}

function validBounds(
    bounds: ProcessExecutionResult['mapLayer']['bounds'] | undefined,
): [number, number, number, number] | null {
    if (!Array.isArray(bounds) || bounds.length !== 4) {
        return null;
    }

    if (!bounds.every((value) => Number.isFinite(value))) {
        return null;
    }

    const [west, south, east, north] = bounds;

    if (west >= east || south >= north) {
        return null;
    }

    return [west, south, east, north];
}

function boundsCenter(
    bounds: [number, number, number, number],
): [number, number] {
    return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

function fitMapToBounds(
    map: maplibregl.Map,
    bounds: [number, number, number, number],
    duration: number,
) {
    map.fitBounds(
        [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
        ],
        { padding: 24, duration },
    );
}
