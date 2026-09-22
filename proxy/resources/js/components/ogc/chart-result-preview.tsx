import { usePage } from '@inertiajs/react';
import { Chart as ChartJS, registerables } from 'chart.js';
import type {
    ChartConfiguration,
    ChartDataset,
    LegendElement,
    LegendItem,
    TooltipItem,
} from 'chart.js';
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AdminBadgePopover } from '@/components/admin-badge';
import RawPayloadBlock from '@/components/ogc/raw-payload-block';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
                setVisibleSeriesCount,
            ),
        );

        chartRef.current = instance;
        setVisibleSeriesCount(countVisibleSeries(instance));

        return () => {
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

    function setAllSeriesVisibility(visible: boolean): void {
        const instance = chartRef.current;

        if (!instance) {
            return;
        }

        lineChart.series.forEach((_, index) => {
            instance.setDatasetVisibility(index, visible);
        });
        instance.update();
        setVisibleSeriesCount(visible ? lineChart.series.length : 0);
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {visibilityControls.showAll || visibilityControls.hideAll ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {visibilityControls.showAll ? (
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => setAllSeriesVisibility(true)}
                        >
                            <EyeIcon data-icon="inline-start" />
                            {t('ogc.chartShowAll')}
                        </Button>
                    ) : null}
                    {visibilityControls.hideAll ? (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setAllSeriesVisibility(false)}
                        >
                            <EyeOffIcon data-icon="inline-start" />
                            {t('ogc.chartHideAll')}
                        </Button>
                    ) : null}
                </div>
            ) : null}
            <div className="h-[28rem] min-w-0 rounded-md bg-background p-3 ring-1 ring-border/50 dark:bg-muted/20">
                <canvas
                    ref={canvasRef}
                    aria-label={chart.domain.description ?? chart.domain.label}
                />
            </div>
            {canViewRawJson ? (
                <RawJsonCollapsible data={data} copyLabel={copyLabel} />
            ) : null}
        </div>
    );
}

function chartConfiguration(
    chart: OgcLineChart,
    palette: string[],
    initialVisibleKeys: Set<string>,
    valueAxisLabel: string,
    language: Language,
    onVisibilityChange: (visibleSeriesCount: number) => void,
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
    grid: string;
    text: string;
    tooltipBackground: string;
    tooltipBorder: string;
    tooltipText: string;
} {
    if (typeof window === 'undefined') {
        return {
            grid: '#d9e5eb',
            text: '#55717e',
            tooltipBackground: '#ffffff',
            tooltipBorder: '#d9e5eb',
            tooltipText: '#173d4b',
        };
    }

    const styles = getComputedStyle(document.documentElement);

    return {
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
