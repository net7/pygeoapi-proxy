import { usePage } from '@inertiajs/react';
import { Chart as ChartJS, registerables } from 'chart.js';
import type {
    ChartConfiguration,
    ChartDataset,
    LegendElement,
    LegendItem,
    TooltipItem,
} from 'chart.js';
import {
    ChevronDownIcon,
    DownloadIcon,
    EyeIcon,
    EyeOffIcon,
    HandIcon,
    Maximize2Icon,
    Minimize2Icon,
    RotateCcwIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { AdminBadgePopover } from '@/components/admin-badge';
import RawPayloadBlock from '@/components/ogc/raw-payload-block';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import type { Language } from '@/lib/i18n/languages';
import {
    chartSeriesVisibilityControls,
    defaultVisibleChartSeriesKeys,
    formatChartNumber,
    normalizeChartPayload,
} from '@/lib/ogc-chart';
import type {
    OgcChartDomain,
    OgcChartSeries,
    OgcLineChart,
} from '@/lib/ogc-chart';
import { cn } from '@/lib/utils';

ChartJS.register(...registerables);

type ChartPoint = {
    x: number;
    y: number;
};

type VisibleSeriesChart = {
    data: {
        datasets: unknown[];
    };
    isDatasetVisible(index: number): boolean;
};

const fallbackColors = [
    '#006380',
    '#008245',
    '#b471ad',
    '#c60e41',
    '#9a8200',
    '#327f98',
    '#8a5c7e',
    '#004458',
];

export default function ChartResultPreview({
    data,
    copyLabel,
}: {
    data: unknown;
    copyLabel?: string;
}) {
    const { language, t } = useTranslation();
    const { auth } = usePage().props;
    const chart = useMemo(
        () => normalizeChartPayload(data, language),
        [data, language],
    );
    const valueAxisLabel = t('ogc.chartValueAxis');
    const chartRef = useRef<ChartJS<'line', ChartPoint[]> | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [visibleSeriesCount, setVisibleSeriesCount] = useState(0);
    const [zoomStatus, setZoomStatus] = useState<
        'loading' | 'ready' | 'unavailable'
    >('loading');
    const [isZoomed, setIsZoomed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const chartId = useId();
    const hintId = useId();
    const canViewRawJson = auth.user?.is_admin === true;

    useEffect(() => {
        if (!chart || !canvasRef.current) {
            return;
        }

        const context = canvasRef.current.getContext('2d');

        if (!context) {
            return;
        }

        const palette = chartPalette(chart.series.length);
        const initialVisibleKeys = new Set(
            defaultVisibleChartSeriesKeys(chart),
        );
        const instance = new ChartJS(
            context,
            chartConfiguration(
                chart,
                palette,
                initialVisibleKeys,
                valueAxisLabel,
                language,
                (count) => {
                    setVisibleSeriesCount(count);
                    setIsZoomed(false);
                },
                setIsZoomed,
            ),
        );

        chartRef.current = instance;
        setVisibleSeriesCount(countVisibleSeries(instance));
        setIsZoomed(false);
        setIsPanning(false);
        setZoomStatus('loading');

        // Hammer.js requires a browser; keep it out of server rendering.
        let disposed = false;

        void import('chartjs-plugin-zoom')
            .then(({ default: zoomPlugin }) => {
                if (disposed) {
                    return;
                }

                ChartJS.register(zoomPlugin);
                instance.update('none');
                setZoomStatus('ready');
            })
            .catch(() => {
                if (!disposed) {
                    setZoomStatus('unavailable');
                }
            });

        return () => {
            disposed = true;
            chartRef.current = null;
            instance.destroy();
            setVisibleSeriesCount(0);
        };
    }, [chart, language, valueAxisLabel]);

    if (!chart) {
        return (
            <RawPayloadBlock data={data} kind="json" copyLabel={copyLabel} />
        );
    }

    const lineChart = chart;
    const visibilityControls = chartSeriesVisibilityControls(
        lineChart,
        visibleSeriesCount,
    );
    const navigationDisabled =
        zoomStatus !== 'ready' || visibleSeriesCount === 0;

    function resetView(): void {
        chartRef.current?.resetZoom?.();
        setIsZoomed(false);
    }

    function setPanMode(enabled: boolean): void {
        const instance = chartRef.current;

        if (!instance) {
            return;
        }

        setChartPanMode(instance, enabled);
        setIsPanning(enabled);
    }

    function downloadImage(): void {
        const instance = chartRef.current;

        if (!instance) {
            return;
        }

        instance.stop();
        instance.setActiveElements([]);
        instance.tooltip?.setActiveElements([], { x: 0, y: 0 });
        instance.update('none');

        const link = document.createElement('a');
        link.download = `${copyLabel?.trim() || 'chart'}.png`;
        link.href = instance.toBase64Image('image/png');
        document.body.append(link);
        link.click();
        link.remove();
    }

    function setAllSeriesVisibility(visible: boolean): void {
        const instance = chartRef.current;

        if (!instance) {
            return;
        }

        lineChart.series.forEach((_, index) => {
            instance.setDatasetVisibility(index, visible);
        });
        resetView();
        instance.update();
        setVisibleSeriesCount(visible ? lineChart.series.length : 0);
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="relative min-w-0 rounded-md bg-background p-3 ring-1 ring-border/50">
                <TooltipProvider delayDuration={200}>
                    <div
                        role="group"
                        aria-label={t('ogc.chartControls')}
                        className="absolute top-3 right-3 flex flex-col gap-2"
                    >
                        <div className="flex flex-col overflow-hidden rounded-md border bg-card shadow-sm">
                            <ChartControlButton
                                label={t('ogc.chartZoomIn')}
                                disabled={navigationDisabled}
                                onClick={() => chartRef.current?.zoom(1.2)}
                            >
                                <ZoomInIcon aria-hidden="true" />
                            </ChartControlButton>
                            <ChartControlButton
                                label={t('ogc.chartZoomOut')}
                                disabled={navigationDisabled || !isZoomed}
                                onClick={() => chartRef.current?.zoom(0.8)}
                            >
                                <ZoomOutIcon aria-hidden="true" />
                            </ChartControlButton>
                            <ChartControlButton
                                label={t('ogc.chartResetView')}
                                disabled={navigationDisabled || !isZoomed}
                                onClick={resetView}
                            >
                                <RotateCcwIcon aria-hidden="true" />
                            </ChartControlButton>
                        </div>
                        <div className="flex flex-col overflow-hidden rounded-md border bg-card shadow-sm">
                            <ChartControlButton
                                label={t('ogc.chartPan')}
                                variant={isPanning ? 'secondary' : 'ghost'}
                                aria-pressed={isPanning}
                                aria-describedby={hintId}
                                disabled={navigationDisabled}
                                onClick={() => setPanMode(!isPanning)}
                            >
                                <HandIcon aria-hidden="true" />
                            </ChartControlButton>
                            <ChartControlButton
                                label={t(
                                    isExpanded
                                        ? 'ogc.chartCollapse'
                                        : 'ogc.chartExpand',
                                )}
                                aria-expanded={isExpanded}
                                aria-controls={chartId}
                                onClick={() =>
                                    setIsExpanded((expanded) => !expanded)
                                }
                            >
                                {isExpanded ? (
                                    <Minimize2Icon aria-hidden="true" />
                                ) : (
                                    <Maximize2Icon aria-hidden="true" />
                                )}
                            </ChartControlButton>
                            <ChartControlButton
                                label={t('ogc.chartDownloadImage')}
                                disabled={visibleSeriesCount === 0}
                                onClick={downloadImage}
                            >
                                <DownloadIcon aria-hidden="true" />
                            </ChartControlButton>
                        </div>
                        {visibilityControls.showAll ||
                        visibilityControls.hideAll ? (
                            <div className="flex flex-col overflow-hidden rounded-md border bg-card shadow-sm">
                                {visibilityControls.showAll ? (
                                    <ChartControlButton
                                        label={t('ogc.chartShowAll')}
                                        variant="default"
                                        onClick={() =>
                                            setAllSeriesVisibility(true)
                                        }
                                    >
                                        <EyeIcon aria-hidden="true" />
                                    </ChartControlButton>
                                ) : null}
                                {visibilityControls.hideAll ? (
                                    <ChartControlButton
                                        label={t('ogc.chartHideAll')}
                                        variant="destructive"
                                        onClick={() =>
                                            setAllSeriesVisibility(false)
                                        }
                                    >
                                        <EyeOffIcon aria-hidden="true" />
                                    </ChartControlButton>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </TooltipProvider>
                <div
                    id={chartId}
                    className={cn(
                        'min-w-0 pr-12',
                        isExpanded ? 'h-[75vh] min-h-[28rem]' : 'h-[28rem]',
                    )}
                >
                    <div className="relative size-full">
                        <canvas
                            ref={canvasRef}
                            className={cn(
                                isPanning
                                    ? 'cursor-grab active:cursor-grabbing'
                                    : 'cursor-crosshair',
                            )}
                            role="img"
                            aria-label={
                                chart.domain.description ?? chart.domain.label
                            }
                            aria-describedby={hintId}
                        />
                    </div>
                </div>
                <p id={hintId} className="pt-3 text-xs text-muted-foreground">
                    {t(
                        zoomStatus === 'unavailable'
                            ? 'ogc.chartZoomUnavailable'
                            : isPanning
                              ? 'ogc.chartPanHint'
                              : 'ogc.chartZoomHint',
                    )}
                </p>
            </div>
            {canViewRawJson ? (
                <RawJsonCollapsible data={data} copyLabel={copyLabel} />
            ) : null}
        </div>
    );
}

function ChartControlButton({
    label,
    children,
    variant = 'ghost',
    ...props
}: Omit<ComponentProps<typeof Button>, 'size' | 'title' | 'aria-label'> & {
    label: string;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex">
                    <Button
                        type="button"
                        variant={variant}
                        size="icon"
                        className="size-9 rounded-none"
                        aria-label={label}
                        {...props}
                    >
                        {children}
                    </Button>
                </span>
            </TooltipTrigger>
            <TooltipContent side="left">{label}</TooltipContent>
        </Tooltip>
    );
}

function setChartPanMode(
    instance: ChartJS<'line', ChartPoint[]>,
    enabled: boolean,
): void {
    const options = instance.options.plugins?.zoom;

    if (!options) {
        return;
    }

    options.pan = { ...options.pan, enabled };
    options.zoom = {
        ...options.zoom,
        drag: { ...options.zoom?.drag, enabled: !enabled },
    };
    instance.update('none');
}

function chartConfiguration(
    chart: OgcLineChart,
    palette: string[],
    initialVisibleKeys: Set<string>,
    valueAxisLabel: string,
    language: Language,
    onVisibilityChange: (visibleSeriesCount: number) => void,
    onViewChange: (isZoomed: boolean) => void,
): ChartConfiguration<'line', ChartPoint[]> {
    const colors = chartCanvasColors();

    return {
        type: 'line',
        plugins: [
            {
                id: 'chart-background',
                beforeDraw({ ctx, width, height }): void {
                    ctx.save();
                    ctx.fillStyle = colors.background;
                    ctx.fillRect(0, 0, width, height);
                    ctx.restore();
                },
            },
        ],
        data: {
            datasets: chart.series.map((series, index) =>
                chartDataset(
                    chart.domain,
                    series,
                    index,
                    palette[index % palette.length],
                    initialVisibleKeys,
                ),
            ),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            parsing: false,
            normalized: true,
            resizeDelay: 80,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            elements: {
                line: {
                    borderCapStyle: 'round',
                    borderJoinStyle: 'round',
                    borderWidth: 2.25,
                    tension: 0.24,
                },
                point: {
                    hitRadius: 8,
                    hoverBorderWidth: 2,
                    hoverRadius: 4.5,
                    radius: 1.25,
                },
            },
            plugins: {
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original' },
                        y: { min: 'original', max: 'original' },
                    },
                    pan: {
                        enabled: false,
                        mode: 'xy',
                        onPan: ({ chart: instance }) =>
                            onViewChange(instance.isZoomedOrPanned()),
                    },
                    zoom: {
                        mode: 'xy',
                        wheel: { enabled: true, modifierKey: 'ctrl' },
                        pinch: { enabled: true },
                        drag: {
                            enabled: true,
                            threshold: 8,
                            borderColor: colors.text,
                            borderWidth: 1,
                        },
                        onZoom: ({ chart: instance }) =>
                            onViewChange(instance.isZoomedOrPanned()),
                    },
                },
                legend: {
                    display: true,
                    align: 'center',
                    position: 'bottom',
                    onClick(_event, legendItem, legend): void {
                        toggleDatasetVisibility(legend, legendItem);
                        onVisibilityChange(countVisibleSeries(legend.chart));
                    },
                    labels: {
                        boxHeight: 9,
                        boxWidth: 9,
                        color: colors.text,
                        font: {
                            size: 13,
                        },
                        generateLabels(chartInstance): LegendItem[] {
                            const generateLabels =
                                ChartJS.defaults.plugins.legend.labels
                                    .generateLabels;
                            const legendItems = generateLabels(chartInstance);

                            legendItems.forEach((legendItem) => {
                                const series =
                                    typeof legendItem.datasetIndex === 'number'
                                        ? chart.series[legendItem.datasetIndex]
                                        : undefined;

                                legendItem.text = chartLegendLabelText(
                                    series,
                                    legendItem.text,
                                );
                            });

                            return legendItems;
                        },
                        padding: 18,
                        pointStyle: 'circle',
                        pointStyleWidth: 11,
                        usePointStyle: true,
                    },
                },
                tooltip: {
                    backgroundColor: colors.tooltipBackground,
                    borderColor: colors.tooltipBorder,
                    borderWidth: 1,
                    bodyColor: colors.tooltipText,
                    bodySpacing: 5,
                    boxPadding: 5,
                    displayColors: true,
                    padding: 10,
                    titleColor: colors.tooltipText,
                    titleMarginBottom: 8,
                    usePointStyle: true,
                    callbacks: {
                        title(items): string {
                            return tooltipTitle(
                                chart.domain,
                                language,
                                items[0],
                            );
                        },
                        label(item): string {
                            return tooltipLabel(
                                chart.series[item.datasetIndex],
                                item,
                                language,
                            );
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: axisLabel(chart.domain),
                        color: colors.text,
                    },
                    ticks: {
                        color: colors.text,
                        maxTicksLimit: 8,
                        callback: (value) =>
                            formatChartNumber(Number(value), language),
                    },
                    grid: {
                        color: colors.grid,
                    },
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: valueAxisLabel,
                        color: colors.text,
                    },
                    ticks: {
                        color: colors.text,
                        callback: (value) =>
                            formatChartNumber(Number(value), language),
                    },
                    grid: {
                        color: colors.grid,
                    },
                },
            },
        },
    };
}

function toggleDatasetVisibility(
    legend: LegendElement<'line'>,
    legendItem: LegendItem,
): void {
    const datasetIndex = legendItem.datasetIndex;

    if (typeof datasetIndex !== 'number') {
        return;
    }

    const chart = legend.chart;

    chart.setDatasetVisibility(
        datasetIndex,
        !chart.isDatasetVisible(datasetIndex),
    );
    chart.resetZoom?.();
    chart.update();
}

function countVisibleSeries(chart: VisibleSeriesChart): number {
    return chart.data.datasets.filter((_, index) =>
        chart.isDatasetVisible(index),
    ).length;
}

function chartDataset(
    domain: OgcChartDomain,
    series: OgcChartSeries,
    index: number,
    color: string,
    initialVisibleKeys: Set<string>,
): ChartDataset<'line', ChartPoint[]> {
    return {
        label: series.label,
        data: series.values.map((value, valueIndex) => ({
            x: domain.values[valueIndex],
            y: value,
        })),
        borderColor: color,
        backgroundColor: color,
        pointBorderColor: color,
        pointBackgroundColor: color,
        hidden: !initialVisibleKeys.has(series.key),
        order: index,
        spanGaps: true,
    };
}

function axisLabel(domain: OgcChartDomain): string {
    return `${domain.label}${unitSuffix(domain.label, domain.unit)}`;
}

function tooltipTitle(
    domain: OgcChartDomain,
    language: Language,
    item?: TooltipItem<'line'>,
): string {
    const value = item?.parsed.x;

    return `${axisLabel(domain)}: ${formatChartNumber(value, language)}`;
}

function tooltipLabel(
    series: OgcChartSeries | undefined,
    item: TooltipItem<'line'>,
    language: Language,
): string {
    const label = series?.label ?? item.dataset.label ?? '';
    const unit = unitSuffix(label, series?.unit, ' ');

    return `${label}: ${formatChartNumber(item.parsed.y, language)}${unit}`;
}

function chartLegendLabelText(
    series: OgcChartSeries | undefined,
    fallbackLabel: string,
): string {
    const label = series?.label ?? fallbackLabel;
    const description = series?.description;

    if (!description || description === label) {
        return label;
    }

    return `${label}: ${description}`;
}

function unitSuffix(
    label: string,
    unit?: string | null,
    prefix: ' ' | '' = ' ',
): string {
    if (!unit || unit === '-' || label.includes('(')) {
        return '';
    }

    return `${prefix}(${unit})`;
}

function chartPalette(count: number): string[] {
    const styles =
        typeof window === 'undefined'
            ? null
            : getComputedStyle(document.documentElement);
    const colors = fallbackColors.map(
        (fallback, index) =>
            styles?.getPropertyValue(`--chart-${index + 1}`).trim() || fallback,
    );

    return Array.from({ length: count }, (_, index) => {
        return colors[index % colors.length];
    });
}

function chartCanvasColors(): {
    background: string;
    grid: string;
    text: string;
    tooltipBackground: string;
    tooltipBorder: string;
    tooltipText: string;
} {
    if (typeof window === 'undefined') {
        return {
            background: '#ffffff',
            grid: '#d9e5eb',
            text: '#55717e',
            tooltipBackground: '#ffffff',
            tooltipBorder: '#d9e5eb',
            tooltipText: '#173d4b',
        };
    }

    const styles = getComputedStyle(document.documentElement);

    return {
        background: styles.getPropertyValue('--background').trim() || '#ffffff',
        grid: styles.getPropertyValue('--border').trim(),
        text: styles.getPropertyValue('--muted-foreground').trim(),
        tooltipBackground: styles.getPropertyValue('--popover').trim(),
        tooltipBorder: styles.getPropertyValue('--border').trim(),
        tooltipText: styles.getPropertyValue('--popover-foreground').trim(),
    };
}

function RawJsonCollapsible({
    data,
    copyLabel,
}: {
    data: unknown;
    copyLabel?: string;
}) {
    const { t } = useTranslation();

    return (
        <Collapsible className="rounded-md border bg-muted/30 dark:bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <CollapsibleTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="px-2 [&[data-state=open]>svg]:rotate-180"
                    >
                        <ChevronDownIcon data-icon="inline-start" />
                        {t('ogc.rawJson')}
                    </Button>
                </CollapsibleTrigger>
                <AdminBadgePopover />
            </div>
            <CollapsibleContent>
                <div className="border-t p-3">
                    <RawPayloadBlock
                        data={data}
                        kind="json"
                        copyLabel={copyLabel}
                    />
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
