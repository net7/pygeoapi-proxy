import * as inertia from '@inertiajs/react';
import { describe, expect, spyOn, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import ChartResultPreview from '../../resources/js/components/ogc/chart-result-preview';

const singleSeriesPlot = {
    chartType: 'line',
    domain: { label: 'Distance', values: [0, 1, 2] },
    series: [{ label: 'Height', values: [10, 20, 15] }],
};

function renderPreview(data: unknown): string {
    const page = spyOn(inertia, 'usePage').mockReturnValue({
        props: { auth: { user: { is_admin: false } } },
    } as ReturnType<typeof inertia.usePage>);

    try {
        return renderToStaticMarkup(<ChartResultPreview data={data} />);
    } finally {
        page.mockRestore();
    }
}

describe('chart navigation controls', () => {
    test('offers accessible navigation and export even for a single series', () => {
        const html = renderPreview(singleSeriesPlot);

        expect(html).toContain('aria-label="Chart controls"');
        expect(html).toContain('aria-label="Zoom in"');
        expect(html).toContain('aria-label="Zoom out"');
        expect(html).toContain('Reset view');
        expect(html).toContain('Pan');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toContain('Expand chart');
        expect(html).toContain('Download PNG');
        expect(html).not.toContain('Show all series');
        expect(html).not.toContain('Raw JSON');
    });

    test('keeps unsupported payloads in the raw viewer without chart controls', () => {
        const html = renderPreview({ message: 'No plot available' });

        expect(html).toContain('Copy raw content');
        expect(html).not.toContain('Chart controls');
        expect(html).not.toContain('<canvas');
    });
});
