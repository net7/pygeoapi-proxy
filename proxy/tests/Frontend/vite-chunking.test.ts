import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

describe('Vite result preview chunking', () => {
    test('loads the MapLibre renderer only for GeoTIFF results', () => {
        const source = readFileSync(
            'resources/js/pages/process-executions/show.tsx',
            'utf8',
        );

        expect(source).toContain(
            "import('@/components/ogc/geotiff-map-result-preview')",
        );
        expect(source).toContain('const GeoTiffMapResultPreview = lazy(');
        expect(source).toContain('<Suspense');
        expect(source).not.toContain(
            "import GeoTiffMapResultPreview from '@/components/ogc/geotiff-map-result-preview'",
        );
    });

    test('isolates the heavy preview vendors with a calibrated warning limit', () => {
        const source = readFileSync('vite.config.ts', 'utf8');

        expect(source).toContain('chunkSizeWarningLimit: 1100');
        expect(source).toContain('codeSplitting:');
        expect(source).toContain("name: 'maplibre'");
        expect(source).toContain("name: 'chart'");
        expect(source).toContain("name: 'json-view'");
    });
});
