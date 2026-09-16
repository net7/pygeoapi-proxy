import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { optimizeDeps, resolveConfig } from 'vite';

describe('Vite result preview chunking', () => {
    test('pre-bundles lazy result viewers before completed results are displayed', async () => {
        const cacheDir = await mkdtemp(join(tmpdir(), 'job-preview-vite-'));
        const previousEnvCheck = process.env.LARAVEL_BYPASS_ENV_CHECK;

        try {
            // Only pre-bundle dependencies; no HMR server is started by this test.
            process.env.LARAVEL_BYPASS_ENV_CHECK = '1';

            const config = await resolveConfig(
                { cacheDir, logLevel: 'silent' },
                'serve',
            );

            const metadata = await optimizeDeps(config, true);

            expect(Object.keys(metadata.optimized)).toEqual(
                expect.arrayContaining([
                    'chart.js',
                    'maplibre-gl',
                    '@uiw/react-json-view',
                    '@uiw/react-json-view/nord',
                ]),
            );
        } finally {
            if (previousEnvCheck === undefined) {
                delete process.env.LARAVEL_BYPASS_ENV_CHECK;
            } else {
                process.env.LARAVEL_BYPASS_ENV_CHECK = previousEnvCheck;
            }

            await rm(cacheDir, { recursive: true, force: true });
        }
    });

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
