import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import { translate } from '../../resources/js/lib/i18n/translation';
import {
    allChartSeriesKeys,
    chartSeriesVisibilityControls,
    defaultVisibleChartSeriesKeys,
    hasMultipleChartSeries,
    normalizeChartPayload,
} from '../../resources/js/lib/ogc-chart';

const chartPayload = {
    chartType: 'line',
    domain: {
        key: 'length(m)',
        label: 'length(m)',
        description: 'distance of the current front from the vent',
        unit: 'm',
        values: [150, 205.202, 248.413, 285.102],
    },
    series: [
        {
            key: 'height(m)',
            label: 'height(m)',
            unit: 'm',
            values: [150, 80.152, 54.692, 41.521],
        },
        {
            key: 'rho_c(kg/m3)',
            label: 'rho_c(kg/m3)',
            unit: 'kg/m^3',
            values: [10.701, 10.692, 10.678, 10.658],
        },
        {
            key: 'u(m/s)',
            label: 'u(m/s)',
            unit: 'm/s',
            values: [130.8, 95.54, 78.86, 68.64],
        },
        {
            key: 'TPE(J)',
            label: 'TPE(J)',
            unit: 'J',
            values: [148500000000, 79300000000, 54030000000, 40930000000],
        },
    ],
};

describe('normalizeChartPayload', () => {
    test('normalizes line chart payloads with numeric domain and series values', () => {
        const chart = normalizeChartPayload(chartPayload);

        expect(chart).not.toBeNull();
        expect(chart?.chartType).toBe('line');
        expect(chart?.domain.label).toBe('length(m)');
        expect(chart?.domain.description).toBe(
            'distance of the current front from the vent',
        );
        expect(chart?.domain.values).toEqual([150, 205.202, 248.413, 285.102]);
        expect(chart?.series.map((series) => series.key)).toEqual([
            'height(m)',
            'rho_c(kg/m3)',
            'u(m/s)',
            'TPE(J)',
        ]);
    });

    test('keeps the first three valid series visible by default', () => {
        const chart = normalizeChartPayload(chartPayload);

        expect(chart).not.toBeNull();
        expect(defaultVisibleChartSeriesKeys(chart)).toEqual([
            'height(m)',
            'rho_c(kg/m3)',
            'u(m/s)',
        ]);
    });

    test('returns all valid series keys for select all controls', () => {
        const chart = normalizeChartPayload(chartPayload);

        expect(chart).not.toBeNull();
        expect(allChartSeriesKeys(chart)).toEqual([
            'height(m)',
            'rho_c(kg/m3)',
            'u(m/s)',
            'TPE(J)',
        ]);
    });

    test('allows bulk visibility controls only when multiple series are available', () => {
        const chart = normalizeChartPayload(chartPayload);
        const singleSeriesChart = normalizeChartPayload({
            ...chartPayload,
            series: chartPayload.series.slice(0, 1),
        });

        expect(hasMultipleChartSeries(chart)).toBe(true);
        expect(hasMultipleChartSeries(singleSeriesChart)).toBe(false);
        expect(hasMultipleChartSeries(null)).toBe(false);
    });

    test('derives bulk visibility controls from visible series state', () => {
        const chart = normalizeChartPayload(chartPayload);
        const singleSeriesChart = normalizeChartPayload({
            ...chartPayload,
            series: chartPayload.series.slice(0, 1),
        });

        expect(chartSeriesVisibilityControls(singleSeriesChart, 1)).toEqual({
            hideAll: false,
            showAll: false,
        });
        expect(chartSeriesVisibilityControls(chart, 4)).toEqual({
            hideAll: true,
            showAll: false,
        });
        expect(chartSeriesVisibilityControls(chart, 0)).toEqual({
            hideAll: false,
            showAll: true,
        });
        expect(chartSeriesVisibilityControls(chart, 2)).toEqual({
            hideAll: true,
            showAll: true,
        });
    });

    test('drops series that do not align with the domain length', () => {
        const chart = normalizeChartPayload({
            ...chartPayload,
            series: [
                ...chartPayload.series,
                {
                    key: 'broken',
                    label: 'Broken',
                    unit: '-',
                    values: [1, 2],
                },
            ],
        });

        expect(chart).not.toBeNull();
        expect(chart?.series.map((series) => series.key)).not.toContain(
            'broken',
        );
    });

    test('rejects unsupported chart types', () => {
        expect(
            normalizeChartPayload({
                ...chartPayload,
                chartType: 'bar',
            }),
        ).toBeNull();
    });
});

describe('chart result preview wiring', () => {
    test('delegates chart previews to the chart renderer component', () => {
        const source = readFileSync(
            'resources/js/components/ogc/result-preview.tsx',
            'utf8',
        );

        expect(source).toContain(
            "import ChartResultPreview from '@/components/ogc/chart-result-preview'",
        );
        expect(source).toContain('<ChartResultPreview data={preview.data} />');
        expect(source).not.toContain('function ChartPreview');
    });

    test('uses the result media type only as the download button label', () => {
        const source = readFileSync(
            'resources/js/components/ogc/result-preview.tsx',
            'utf8',
        );

        expect(source).toContain('downloadLabelForMediaType(result.mediaType)');
        expect(source).not.toContain(
            '<CardDescription>{result.mediaType}</CardDescription>',
        );
    });

    test('shows raw chart json only to admins in a collapsible panel', () => {
        const source = readFileSync(
            'resources/js/components/ogc/chart-result-preview.tsx',
            'utf8',
        );

        expect(source).toContain("import { usePage } from '@inertiajs/react'");
        expect(source).toContain('auth.user?.is_admin === true');
        expect(source).toContain('Collapsible');
        expect(source).toContain("t('jobs.adminOnlySection')");
        expect(source).toContain('JSON.stringify(data, null, 2)');
    });

    test('moves series descriptions from tooltip into a centered bottom legend', () => {
        const source = readFileSync(
            'resources/js/components/ogc/chart-result-preview.tsx',
            'utf8',
        );

        expect(source).toContain('tooltipLabel(');
        expect(source).toContain('chartLegendLabelText(');
        expect(source).toContain("align: 'center'");
        expect(source).toContain('font: {');
        expect(source).toContain('generateLabels(chartInstance)');
        expect(source).toContain('legendItem.text = chartLegendLabelText(');
        expect(source).not.toContain('splitTooltipDescription');
        expect(source).toContain('usePointStyle: true');
        expect(source).toContain('borderCapStyle:');
        expect(source).toContain('hoverBorderWidth:');
    });

    test('labels series visibility controls explicitly with semantic icons and variants', () => {
        const source = readFileSync(
            'resources/js/components/ogc/chart-result-preview.tsx',
            'utf8',
        );

        expect(translate('it', 'ogc.chartShowAll')).toBe(
            'Mostra tutte le serie',
        );
        expect(translate('it', 'ogc.chartHideAll')).toBe(
            'Nascondi tutte le serie',
        );
        expect(source).toContain('EyeIcon');
        expect(source).toContain('EyeOffIcon');
        expect(source).toContain('chartSeriesVisibilityControls(');
        expect(source).toContain('visibleSeriesCount');
        expect(source).toContain('variant="default"');
        expect(source).toContain('variant="destructive"');
    });
});
