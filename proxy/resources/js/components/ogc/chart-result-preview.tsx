import { usePage } from '@inertiajs/react';
import { Chart as ChartJS, registerables } from 'chart.js';
import type { ChartConfiguration, ChartDataset, TooltipItem } from 'chart.js';
import {
    ChevronDownIcon,
    EyeIcon,
    EyeOffIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTranslation } from '@/hooks/use-translation';
import {
    defaultVisibleChartSeriesKeys,
    hasMultipleChartSeries,
    normalizeChartPayload,
} from '@/lib/ogc-chart';
import type {
    OgcChartDomain,
    OgcChartSeries,
    OgcLineChart,
} from '@/lib/ogc-chart';

ChartJS.register(...registerables);

type ChartPoint = {
    x: number;
    y: number;
};

const fallbackColors = [
    '#2563eb',
    '#ea580c',
    '#16a34a',
    '#7c3aed',
    '#be123c',
    '#0891b2',
    '#ca8a04',
    '#475569',
];

export default function ChartResultPreview({ data }: { data: unknown }) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const chart = useMemo(() => normalizeChartPayload(data), [data]);
    const chartRef = useRef<ChartJS<'line', ChartPoint[]> | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
                t('ogc.chartValueAxis'),
            ),
        );

        chartRef.current = instance;

        return () => {
            chartRef.current = null;
            instance.destroy();
        };
    }, [chart, t]);

    if (!chart) {
        return <JsonFallback data={data} />;
    }

    const lineChart = chart;
    const canToggleAllSeries = hasMultipleChartSeries(lineChart);

    function setAllSeriesVisibility(visible: boolean): void {
        const instance = chartRef.current;

        if (!instance) {
            return;
        }

        lineChart.series.forEach((_, index) => {
            instance.setDatasetVisibility(index, visible);
        });
        instance.update();
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {canToggleAllSeries ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setAllSeriesVisibility(true)}
                    >
                        <EyeIcon data-icon="inline-start" />
                        {t('ogc.chartShowAll')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAllSeriesVisibility(false)}
                    >
                        <EyeOffIcon data-icon="inline-start" />
                        {t('ogc.chartHideAll')}
                    </Button>
                </div>
            ) : null}
            <div className="h-[28rem] min-w-0 rounded-md bg-background p-3 ring-1 ring-border/50 dark:bg-muted/20">
                <canvas
                    ref={canvasRef}
                    aria-label={chart.domain.description ?? chart.domain.label}
                />
            </div>
            {canViewRawJson ? <RawJsonCollapsible data={data} /> : null}
        </div>
    );
}

function chartConfiguration(
    chart: OgcLineChart,
    palette: string[],
    initialVisibleKeys: Set<string>,
    valueAxisLabel: string,
): ChartConfiguration<'line', ChartPoint[]> {
    const colors = chartCanvasColors();

    return {
        type: 'line',
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
                legend: {
                    display: true,
                    align: 'start',
                    position: 'bottom',
                    labels: {
                        boxHeight: 7,
                        boxWidth: 7,
                        color: colors.text,
                        padding: 16,
                        pointStyle: 'circle',
                        pointStyleWidth: 9,
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
                            return tooltipTitle(chart.domain, items[0]);
                        },
                        label(item): string[] {
                            return tooltipLabel(
                                chart.series[item.datasetIndex],
                                item,
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
                        callback: (value) => formatNumber(Number(value)),
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
                        callback: (value) => formatNumber(Number(value)),
                    },
                    grid: {
                        color: colors.grid,
                    },
                },
            },
        },
    };
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
    item?: TooltipItem<'line'>,
): string {
    const value = item?.parsed.x;

    return `${axisLabel(domain)}: ${formatNumber(value)}`;
}

function tooltipLabel(
    series: OgcChartSeries | undefined,
    item: TooltipItem<'line'>,
): string[] {
    const label = series?.label ?? item.dataset.label ?? '';
    const unit = unitSuffix(label, series?.unit, ' ');
    const lines = [`${label}: ${formatNumber(item.parsed.y)}${unit}`];

    if (series?.description) {
        lines.push(...splitTooltipDescription(series.description));
    }

    return lines;
}

function splitTooltipDescription(description: string): string[] {
    const maxLineLength = 64;
    const words = description.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;

        if (nextLine.length > maxLineLength && currentLine) {
            lines.push(currentLine);
            currentLine = word;

            return;
        }

        currentLine = nextLine;
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
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

function formatNumber(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value)
        ? new Intl.NumberFormat(undefined, {
              maximumFractionDigits: 4,
              notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
          }).format(value)
        : '';
}

function chartPalette(count: number): string[] {
    return Array.from({ length: count }, (_, index) => {
        return fallbackColors[index % fallbackColors.length];
    });
}

function chartCanvasColors(): {
    grid: string;
    text: string;
    tooltipBackground: string;
    tooltipBorder: string;
    tooltipText: string;
} {
    if (typeof window === 'undefined') {
        return {
            grid: 'rgba(148, 163, 184, 0.28)',
            text: '#64748b',
            tooltipBackground: 'rgba(15, 23, 42, 0.94)',
            tooltipBorder: 'rgba(148, 163, 184, 0.28)',
            tooltipText: '#f8fafc',
        };
    }

    const isDark = document.documentElement.classList.contains('dark');

    return {
        grid: isDark
            ? 'rgba(148, 163, 184, 0.22)'
            : 'rgba(100, 116, 139, 0.22)',
        text: isDark ? '#cbd5e1' : '#64748b',
        tooltipBackground: isDark
            ? 'rgba(2, 6, 23, 0.95)'
            : 'rgba(15, 23, 42, 0.94)',
        tooltipBorder: isDark
            ? 'rgba(148, 163, 184, 0.24)'
            : 'rgba(148, 163, 184, 0.28)',
        tooltipText: '#f8fafc',
    };
}

function RawJsonCollapsible({ data }: { data: unknown }) {
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
                <Badge
                    variant="destructive"
                    className="h-5 shrink-0 px-1.5 text-[10px] uppercase"
                >
                    <ShieldCheckIcon data-icon="inline-start" />
                    {t('jobs.adminOnlySection')}
                </Badge>
            </div>
            <CollapsibleContent>
                <div className="border-t p-3">
                    <JsonFallback data={data} />
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function JsonFallback({ data }: { data: unknown }) {
    return (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs ring-1 ring-border/50 dark:bg-muted/50 dark:text-foreground">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}
