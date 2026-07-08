export type OgcChartDomain = {
    key: string;
    label: string;
    description?: string | null;
    unit?: string | null;
    values: number[];
};

export type OgcChartSeries = {
    key: string;
    label: string;
    description?: string | null;
    unit?: string | null;
    values: number[];
};

export type OgcLineChart = {
    chartType: 'line';
    domain: OgcChartDomain;
    series: OgcChartSeries[];
};

const defaultVisibleSeriesCount = 3;

export function normalizeChartPayload(payload: unknown): OgcLineChart | null {
    if (!isRecord(payload) || payload.chartType !== 'line') {
        return null;
    }

    const domain = normalizeDomain(payload.domain);

    if (!domain) {
        return null;
    }

    if (!Array.isArray(payload.series)) {
        return null;
    }

    const series = payload.series
        .map((item, index) =>
            normalizeSeries(item, domain.values.length, index),
        )
        .filter((item): item is OgcChartSeries => item !== null);

    if (series.length === 0) {
        return null;
    }

    return {
        chartType: 'line',
        domain,
        series,
    };
}

export function defaultVisibleChartSeriesKeys(
    chart: OgcLineChart | null,
): string[] {
    return (
        chart?.series
            .slice(0, defaultVisibleSeriesCount)
            .map((series) => series.key) ?? []
    );
}

export function allChartSeriesKeys(chart: OgcLineChart | null): string[] {
    return chart?.series.map((series) => series.key) ?? [];
}

export function hasMultipleChartSeries(chart: OgcLineChart | null): boolean {
    return (chart?.series.length ?? 0) > 1;
}

function normalizeDomain(value: unknown): OgcChartDomain | null {
    if (!isRecord(value) || !Array.isArray(value.values)) {
        return null;
    }

    const values = normalizeNumericValues(value.values);

    if (values.length === 0 || values.length !== value.values.length) {
        return null;
    }

    return {
        key: stringValue(value.key, 'domain'),
        label: stringValue(value.label, stringValue(value.key, 'Domain')),
        description: optionalStringValue(value.description),
        unit: optionalStringValue(value.unit),
        values,
    };
}

function normalizeSeries(
    value: unknown,
    expectedLength: number,
    index: number,
): OgcChartSeries | null {
    if (!isRecord(value) || !Array.isArray(value.values)) {
        return null;
    }

    const values = normalizeNumericValues(value.values);

    if (
        values.length !== expectedLength ||
        values.length !== value.values.length
    ) {
        return null;
    }

    const key = stringValue(value.key, `series-${index + 1}`);

    return {
        key,
        label: stringValue(value.label, key),
        description: optionalStringValue(value.description),
        unit: optionalStringValue(value.unit),
        values,
    };
}

function normalizeNumericValues(values: unknown[]): number[] {
    return values.filter(
        (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
    );
}

function stringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim()
        : fallback;
}

function optionalStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim()
        : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
