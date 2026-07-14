# GeoTIFF SLD Map Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render GeoTIFF+SLD object outputs as one map preview card while preserving authorized per-file downloads.

**Architecture:** Keep `ProcessExecutionResult` rows atomic and group only in the React presentation layer. Add a policy-protected Laravel preview-file endpoint that reuses on-demand caching, then let the browser decode GeoTIFF, parse SLD best-effort, draw a canvas, and display that canvas in MapLibre.

**Tech Stack:** Laravel 13, Inertia React 3, React 19, Wayfinder, Pest 4, Bun tests, MapLibre GL JS, GeoTIFF.js, GeoStyler SLD parser, Tailwind CSS 4.

---

## File Map

- Modify `package.json`, `package-lock.json`, and `bun.lock`: add frontend dependencies.
- Modify `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`: share result caching between download and preview, add `previewFile()`.
- Modify `routes/web.php`: add `jobs.results.preview-file`.
- Modify generated Wayfinder files under `resources/js/routes/jobs/results/index.ts` and `resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionResultController.ts`.
- Modify `tests/Feature/Ogc/ProcessExecutionResultTest.php`: cover preview authorization, ownership checks, media type checks, and on-demand caching.
- Create `resources/js/lib/ogc-result-groups.ts`: group flat results into visual result items.
- Modify `tests/Frontend/ogc-outputs.test.ts`: test result grouping.
- Create `resources/js/lib/geotiff-map-preview.ts`: decode GeoTIFF buffers, parse SLD best-effort, build a canvas preview payload.
- Create `tests/Frontend/geotiff-map-preview.test.ts`: test pure helper behavior that does not require a real DOM canvas.
- Create `resources/js/types/geostyler-sld-parser.d.ts`: provide the parser typing used by the preview builder.
- Create `resources/js/components/ogc/geotiff-map-result-preview.tsx`: render map card, fetch protected preview files, initialize MapLibre.
- Modify `resources/js/pages/process-executions/show.tsx`: use grouped visual results and visual count.
- Modify `resources/js/lib/i18n/messages.ts`: add map preview labels in Italian and English.
- Modify `tests/Unit/ProcessUiLayoutTest.php`: extend source checks for the grouped result renderer.

---

### Task 1: Add Frontend Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install packages**

Run:

```bash
bun add maplibre-gl geotiff geostyler-sld-parser
```

Expected: `package.json`, `package-lock.json`, and `bun.lock` include `maplibre-gl`, `geotiff`, and `geostyler-sld-parser`.

- [ ] **Step 2: Run dependency sanity check**

Run:

```bash
bunx tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 3: Commit dependency update**

Run:

```bash
git add package.json package-lock.json bun.lock
git commit -m "build: add geotiff map preview dependencies"
```

Expected: one commit containing only dependency metadata.

---

### Task 2: Write Backend Preview Endpoint Tests

**Files:**
- Modify: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Add focused tests**

Append these tests to `tests/Feature/Ogc/ProcessExecutionResultTest.php`:

```php
test('users can preview cached geotiff and sld files inline', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $geotiff = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'storage_path' => 'ogc-results/dem.geotiff',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    $sld = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.sld',
        'media_type' => 'application/vnd.ogc.sld+xml',
        'storage_path' => 'ogc-results/dem.sld',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/dem.geotiff', 'GEOTIFF');
    Storage::disk('local')->put('ogc-results/dem.sld', '<StyledLayerDescriptor />');

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$geotiff->id}/preview-file")
        ->assertOk()
        ->assertHeader('content-disposition', 'inline; filename="dem.geotiff"')
        ->assertSee('GEOTIFF', false);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$sld->id}/preview-file")
        ->assertOk()
        ->assertHeader('content-disposition', 'inline; filename="dem.sld"')
        ->assertSee('<StyledLayerDescriptor />', false);
});

test('preview file endpoint rejects users who cannot view the job', function () {
    Storage::fake('local');

    $execution = ProcessExecution::factory()->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'storage_path' => 'ogc-results/dem.geotiff',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/dem.geotiff', 'GEOTIFF');

    $this->actingAs(User::factory()->create())
        ->get("/jobs/{$execution->id}/results/{$result->id}/preview-file")
        ->assertForbidden();
});

test('preview file endpoint rejects results from a different job', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $otherExecution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($otherExecution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'storage_path' => 'ogc-results/dem.geotiff',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/dem.geotiff', 'GEOTIFF');

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/preview-file")
        ->assertNotFound();
});

test('preview file endpoint rejects non map preview media types', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'outfile',
        'media_type' => 'text/csv',
        'storage_path' => 'ogc-results/outfile.csv',
        'cache_status' => ResultCacheStatus::Cached,
    ]);

    Storage::disk('local')->put('ogc-results/outfile.csv', "a,b\n1,2\n");

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/preview-file")
        ->assertNotFound();
});

test('preview file endpoint caches remote map files on demand', function () {
    Storage::fake('local');
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/dem.tif' => Http::response('GEOTIFF', 200, [
            'Content-Type' => 'image/tiff; application=geotiff',
        ]),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-1',
    ]);

    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'remote_href' => 'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/dem.tif',
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::MetadataOnly,
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/preview-file")
        ->assertOk()
        ->assertHeader('content-disposition', 'inline; filename="dem.geotiff"')
        ->assertSee('GEOTIFF', false);

    Storage::disk('local')->assertExists("ogc-results/{$execution->id}/dem.geotiff");
    expect($result->refresh()->cache_status)->toBe(ResultCacheStatus::Cached);
});

test('preview file endpoint returns not found when no file can be resolved', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'dem.geotiff',
        'media_type' => 'image/tiff; application=geotiff',
        'remote_href' => null,
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::MetadataOnly,
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/preview-file")
        ->assertNotFound();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: failures for missing route or missing `previewFile` action.

- [ ] **Step 3: Commit failing tests**

Run:

```bash
git add tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "test: cover protected result preview files"
```

Expected: one commit containing only backend tests.

---

### Task 3: Implement Backend Preview Endpoint

**Files:**
- Modify: `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Replace controller with shared cache and preview support**

Update `app/Http/Controllers/Ogc/ProcessExecutionResultController.php` to this structure:

```php
<?php

namespace App\Http\Controllers\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessExecutionResultController extends Controller
{
    public function download(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): Response {
        $this->authorizeResult($processExecution, $result);
        $this->ensureResultFileIsCached($processExecution, $result, $client);

        abort_unless(filled($result->storage_path), 404);

        return $this->fileResponse($result, 'attachment');
    }

    public function previewFile(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): Response {
        $this->authorizeResult($processExecution, $result);

        abort_unless($this->isMapPreviewMediaType($result->media_type), 404);

        $this->ensureResultFileIsCached($processExecution, $result, $client);

        abort_unless(filled($result->storage_path), 404);

        return $this->fileResponse($result, 'inline');
    }

    private function authorizeResult(ProcessExecution $processExecution, ProcessExecutionResult $result): void
    {
        Gate::authorize('view', $processExecution);

        abort_unless($result->process_execution_id === $processExecution->id, 404);
    }

    private function ensureResultFileIsCached(
        ProcessExecution $processExecution,
        ProcessExecutionResult $result,
        OgcProcessesClient $client,
    ): void {
        if (filled($result->storage_path) || blank($result->remote_href)) {
            return;
        }

        $remoteResponse = $client->downloadResultUrl($result->remote_href);
        $body = $remoteResponse->body();
        $path = "ogc-results/{$processExecution->id}/".$this->resultFileName($result);
        $mediaType = Str::of((string) $remoteResponse->header('Content-Type'))
            ->trim()
            ->lower()
            ->toString();

        Storage::disk('local')->put($path, $body);

        $result->update([
            'media_type' => $mediaType ?: $result->media_type,
            'storage_path' => $path,
            'size_bytes' => strlen($body),
            'cache_status' => ResultCacheStatus::Cached,
        ]);
    }

    private function fileResponse(ProcessExecutionResult $result, string $disposition): Response
    {
        return response(Storage::disk('local')->get($result->storage_path), 200, [
            'Content-Type' => $result->media_type ?: 'application/octet-stream',
            'Content-Disposition' => "{$disposition}; filename=\"".$this->resultFileName($result).'"',
        ]);
    }

    private function isMapPreviewMediaType(?string $mediaType): bool
    {
        $normalized = Str::of((string) $mediaType)->trim()->lower()->toString();
        $baseMediaType = Str::of($normalized)->before(';')->trim()->toString();

        $isGeoTiff = in_array($baseMediaType, ['image/tiff', 'application/tiff'], true)
            && str_contains($normalized, 'geotiff');

        return $isGeoTiff || $baseMediaType === 'application/vnd.ogc.sld+xml';
    }

    private function resultFileName(ProcessExecutionResult $result): string
    {
        $fileName = Str::of($result->output_id)
            ->replaceMatches('/[^A-Za-z0-9._-]+/', '_')
            ->trim('._-')
            ->toString();

        return $fileName !== '' ? $fileName : "result-{$result->id}";
    }
}
```

- [ ] **Step 2: Add route**

In `routes/web.php`, add the preview route immediately after the download route:

```php
Route::get('jobs/{processExecution}/results/{result}/preview-file', [ProcessExecutionResultController::class, 'previewFile'])
    ->name('jobs.results.preview-file');
```

- [ ] **Step 3: Run focused backend test**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: all tests in `ProcessExecutionResultTest.php` pass.

- [ ] **Step 4: Format PHP**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: Pint reports files formatted or already clean.

- [ ] **Step 5: Commit backend endpoint**

Run:

```bash
git add app/Http/Controllers/Ogc/ProcessExecutionResultController.php routes/web.php tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "feat: add protected result preview files"
```

Expected: one commit containing the passing backend endpoint implementation.

---

### Task 4: Regenerate Wayfinder Routes

**Files:**
- Modify: `resources/js/routes/jobs/results/index.ts`
- Modify: `resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionResultController.ts`

- [ ] **Step 1: Generate route helpers**

Run:

```bash
php artisan wayfinder:generate --no-interaction
```

Expected: generated route helpers include `previewFile`.

- [ ] **Step 2: Inspect generated names**

Run:

```bash
rg -n "previewFile|preview-file" resources/js/routes/jobs/results/index.ts resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionResultController.ts
```

Expected: output contains `previewFile` function and `/jobs/{processExecution}/results/{result}/preview-file`.

- [ ] **Step 3: Commit generated route helpers**

Run:

```bash
git add resources/js/routes/jobs/results/index.ts resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionResultController.ts
git commit -m "build: regenerate result route helpers"
```

Expected: one commit containing only generated TypeScript route files.

---

### Task 5: Add Result Grouping Helper

**Files:**
- Create: `resources/js/lib/ogc-result-groups.ts`
- Modify: `tests/Frontend/ogc-outputs.test.ts`

- [ ] **Step 1: Write failing grouping tests**

Add this import to `tests/Frontend/ogc-outputs.test.ts`:

```ts
import { groupProcessResults } from '../../resources/js/lib/ogc-result-groups';
import type { ProcessExecutionResult } from '../../resources/js/types';
```

Append these tests:

```ts
const result = (
    overrides: Partial<ProcessExecutionResult>,
): ProcessExecutionResult => ({
    id: overrides.id ?? 1,
    outputId: overrides.outputId ?? 'gas',
    title: overrides.title ?? null,
    description: overrides.description ?? null,
    mediaType: overrides.mediaType ?? 'application/json',
    cacheStatus: overrides.cacheStatus ?? 'cached',
    preview: overrides.preview ?? null,
});

describe('groupProcessResults', () => {
    test('groups geotiff and sld components into one visual map output', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                title: 'Primary DEM - Reference to the GeoTIFF.',
                mediaType: 'image/tiff; application=geotiff',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                title: 'Primary DEM - Reference to the Styled Layer Descriptor.',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            kind: 'geotiff-map',
            outputId: 'dem',
            title: 'Primary DEM',
        });
    });

    test('keeps unpaired map components as single results', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                mediaType: 'image/tiff; application=geotiff',
            }),
            result({
                id: 12,
                outputId: 'gas',
                mediaType: 'application/json',
            }),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].kind).toBe('result');
        expect(groups[1].kind).toBe('result');
    });

    test('does not group incompatible media types', () => {
        const groups = groupProcessResults([
            result({
                id: 10,
                outputId: 'dem.geotiff',
                mediaType: 'text/plain',
            }),
            result({
                id: 11,
                outputId: 'dem.sld',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups.every((group) => group.kind === 'result')).toBe(true);
    });

    test('preserves order and emits each map group once', () => {
        const groups = groupProcessResults([
            result({ id: 1, outputId: 'input_data', mediaType: 'text/plain' }),
            result({
                id: 2,
                outputId: 'invasion_map.sld',
                title: 'Invasion Map - Styled Layer Descriptor',
                mediaType: 'application/vnd.ogc.sld+xml',
            }),
            result({
                id: 3,
                outputId: 'invasion_map.geotiff',
                title: 'Invasion Map - Reference to the GeoTIFF.',
                mediaType: 'application/tiff; application=geotiff',
            }),
        ]);

        expect(groups.map((group) => group.kind)).toEqual([
            'result',
            'geotiff-map',
        ]);
        expect(groups[1]).toMatchObject({
            kind: 'geotiff-map',
            outputId: 'invasion_map',
            title: 'Invasion Map',
        });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun test tests/Frontend/ogc-outputs.test.ts
```

Expected: failure because `resources/js/lib/ogc-result-groups.ts` does not exist.

- [ ] **Step 3: Create grouping helper**

Create `resources/js/lib/ogc-result-groups.ts`:

```ts
import type { ProcessExecutionResult } from '@/types';

export type ProcessResultVisualItem =
    | {
          kind: 'result';
          result: ProcessExecutionResult;
      }
    | {
          kind: 'geotiff-map';
          outputId: string;
          title: string;
          description?: string | null;
          geotiff: ProcessExecutionResult;
          sld: ProcessExecutionResult;
      };

type ComponentName = 'geotiff' | 'sld';

type OutputComponentMatch = {
    outputId: string;
    component: ComponentName;
};

export function groupProcessResults(
    results: ProcessExecutionResult[],
): ProcessResultVisualItem[] {
    const components = new Map<
        string,
        Partial<Record<ComponentName, ProcessExecutionResult>>
    >();

    for (const result of results) {
        const match = outputComponentMatch(result.outputId);

        if (!match) {
            continue;
        }

        const outputComponents = components.get(match.outputId) ?? {};
        outputComponents[match.component] = result;
        components.set(match.outputId, outputComponents);
    }

    const groupedOutputIds = new Set<string>();

    for (const [outputId, outputComponents] of components.entries()) {
        if (
            outputComponents.geotiff &&
            outputComponents.sld &&
            isGeoTiffResult(outputComponents.geotiff) &&
            isSldResult(outputComponents.sld)
        ) {
            groupedOutputIds.add(outputId);
        }
    }

    const emittedGroups = new Set<string>();
    const visualItems: ProcessResultVisualItem[] = [];

    for (const result of results) {
        const match = outputComponentMatch(result.outputId);

        if (!match || !groupedOutputIds.has(match.outputId)) {
            visualItems.push({ kind: 'result', result });
            continue;
        }

        if (emittedGroups.has(match.outputId)) {
            continue;
        }

        const outputComponents = components.get(match.outputId);
        const geotiff = outputComponents?.geotiff;
        const sld = outputComponents?.sld;

        if (!geotiff || !sld) {
            visualItems.push({ kind: 'result', result });
            continue;
        }

        visualItems.push({
            kind: 'geotiff-map',
            outputId: match.outputId,
            title: groupedTitle(match.outputId, geotiff, sld),
            description: geotiff.description ?? sld.description,
            geotiff,
            sld,
        });
        emittedGroups.add(match.outputId);
    }

    return visualItems;
}

function outputComponentMatch(outputId: string): OutputComponentMatch | null {
    const match = outputId.match(/^(.+)\.(geotiff|sld)$/);

    if (!match) {
        return null;
    }

    return {
        outputId: match[1],
        component: match[2] as ComponentName,
    };
}

function groupedTitle(
    outputId: string,
    geotiff: ProcessExecutionResult,
    sld: ProcessExecutionResult,
): string {
    const componentTitle = geotiff.title ?? sld.title;

    if (componentTitle?.includes(' - ')) {
        return componentTitle.split(' - ')[0];
    }

    return humanizeOutputId(outputId);
}

function humanizeOutputId(outputId: string): string {
    return outputId
        .split(/[_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function isGeoTiffResult(result: ProcessExecutionResult): boolean {
    const mediaType = normalizedMediaType(result.mediaType);

    return (
        (mediaType.startsWith('image/tiff') ||
            mediaType.startsWith('application/tiff')) &&
        mediaType.includes('geotiff')
    );
}

function isSldResult(result: ProcessExecutionResult): boolean {
    return (
        baseMediaType(result.mediaType) === 'application/vnd.ogc.sld+xml'
    );
}

function normalizedMediaType(mediaType?: string | null): string {
    return String(mediaType ?? '')
        .trim()
        .toLowerCase();
}

function baseMediaType(mediaType?: string | null): string {
    return normalizedMediaType(mediaType).split(';')[0].trim();
}
```

- [ ] **Step 4: Run frontend grouping tests**

Run:

```bash
bun test tests/Frontend/ogc-outputs.test.ts
```

Expected: all tests in `ogc-outputs.test.ts` pass.

- [ ] **Step 5: Commit grouping helper**

Run:

```bash
git add resources/js/lib/ogc-result-groups.ts tests/Frontend/ogc-outputs.test.ts
git commit -m "feat: group geotiff sld result outputs"
```

Expected: one commit containing grouping helper and tests.

---

### Task 6: Add GeoTIFF Canvas Preview Builder

**Files:**
- Create: `resources/js/lib/geotiff-map-preview.ts`
- Create: `resources/js/types/geostyler-sld-parser.d.ts`
- Create: `tests/Frontend/geotiff-map-preview.test.ts`

- [ ] **Step 1: Add minimal parser type declaration**

Create `resources/js/types/geostyler-sld-parser.d.ts`:

```ts
declare module 'geostyler-sld-parser' {
    export default class SLDParser {
        readStyle(input: string): Promise<{
            output?: unknown;
            errors?: unknown[];
        }>;
    }
}
```

- [ ] **Step 2: Write pure helper tests**

Create `tests/Frontend/geotiff-map-preview.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
    colorForValue,
    colorStopsFromGeoStylerStyle,
    isLngLatBoundingBox,
    scaledRasterSize,
} from '../../resources/js/lib/geotiff-map-preview';

describe('GeoTIFF map preview helpers', () => {
    test('accepts only longitude latitude bounding boxes', () => {
        expect(isLngLatBoundingBox([14, 40, 15, 41])).toBe(true);
        expect(isLngLatBoundingBox([500000, 4500000, 501000, 4501000])).toBe(
            false,
        );
        expect(isLngLatBoundingBox([15, 40, 14, 41])).toBe(false);
    });

    test('scales raster dimensions without upscaling', () => {
        expect(scaledRasterSize(4000, 2000, 1024)).toEqual({
            width: 1024,
            height: 512,
        });
        expect(scaledRasterSize(400, 200, 1024)).toEqual({
            width: 400,
            height: 200,
        });
    });

    test('extracts raster color map stops from a GeoStyler style', () => {
        const stops = colorStopsFromGeoStylerStyle({
            rules: [
                {
                    symbolizers: [
                        {
                            kind: 'Raster',
                            colorMap: {
                                colorMapEntries: [
                                    { color: '#000000', quantity: 0 },
                                    { color: '#ffffff', quantity: 100 },
                                ],
                            },
                        },
                    ],
                },
            ],
        });

        expect(stops).toEqual([
            { color: [0, 0, 0, 255], quantity: 0 },
            { color: [255, 255, 255, 255], quantity: 100 },
        ]);
    });

    test('interpolates colors between stops', () => {
        expect(
            colorForValue(50, [
                { color: [0, 0, 0, 255], quantity: 0 },
                { color: [100, 100, 100, 255], quantity: 100 },
            ]),
        ).toEqual([50, 50, 50, 255]);
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
bun test tests/Frontend/geotiff-map-preview.test.ts
```

Expected: failure because `resources/js/lib/geotiff-map-preview.ts` does not exist.

- [ ] **Step 4: Create preview builder**

Create `resources/js/lib/geotiff-map-preview.ts`:

```ts
import { fromArrayBuffer } from 'geotiff';
import SLDParser from 'geostyler-sld-parser';

export type Rgba = [number, number, number, number];

export type ColorStop = {
    quantity: number;
    color: Rgba;
};

export type GeoTiffMapPreview = {
    canvas: HTMLCanvasElement;
    coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
    bounds: [number, number, number, number];
    styleWarning: string | null;
};

export async function buildGeoTiffMapPreview({
    geotiffBuffer,
    sldText,
    maxSize = 1024,
    signal,
}: {
    geotiffBuffer: ArrayBuffer;
    sldText: string;
    maxSize?: number;
    signal?: AbortSignal;
}): Promise<GeoTiffMapPreview> {
    const tiff = await fromArrayBuffer(geotiffBuffer, signal);
    const image = await tiff.getImage();
    const bounds = image.getBoundingBox();

    if (!isLngLatBoundingBox(bounds)) {
        throw new Error('unsupported-bounds');
    }

    const size = scaledRasterSize(image.getWidth(), image.getHeight(), maxSize);
    const raster = await image.readRasters({
        samples: [0],
        width: size.width,
        height: size.height,
        resampleMethod: 'bilinear',
        signal,
    });

    const band = Array.isArray(raster) ? raster[0] : raster;
    const values = Array.from(band as ArrayLike<number>);
    const [minimum, maximum] = valueRange(values);
    const styleResult = await readSldColorStops(sldText);
    const colorStops =
        styleResult.colorStops.length > 0
            ? styleResult.colorStops
            : [
                  { quantity: minimum, color: [35, 55, 72, 255] as Rgba },
                  { quantity: maximum, color: [238, 232, 178, 255] as Rgba },
              ];

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('canvas-context-unavailable');
    }

    const imageData = context.createImageData(size.width, size.height);

    for (let index = 0; index < values.length; index += 1) {
        const color = Number.isFinite(values[index])
            ? colorForValue(values[index], colorStops)
            : ([0, 0, 0, 0] as Rgba);
        const offset = index * 4;

        imageData.data[offset] = color[0];
        imageData.data[offset + 1] = color[1];
        imageData.data[offset + 2] = color[2];
        imageData.data[offset + 3] = color[3];
    }

    context.putImageData(imageData, 0, 0);

    const [west, south, east, north] = bounds;

    return {
        canvas,
        coordinates: [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
        ],
        bounds,
        styleWarning: styleResult.warning,
    };
}

export function isLngLatBoundingBox(
    bounds: number[],
): bounds is [number, number, number, number] {
    if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
        return false;
    }

    const [west, south, east, north] = bounds;

    return (
        west >= -180 &&
        east <= 180 &&
        south >= -90 &&
        north <= 90 &&
        west < east &&
        south < north
    );
}

export function scaledRasterSize(
    width: number,
    height: number,
    maxSize: number,
): { width: number; height: number } {
    const scale = Math.min(1, maxSize / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

export function colorStopsFromGeoStylerStyle(style: unknown): ColorStop[] {
    const rules = recordArray(propertyRecord(style, 'rules'));

    for (const rule of rules) {
        const symbolizers = recordArray(propertyRecord(rule, 'symbolizers'));

        for (const symbolizer of symbolizers) {
            if (symbolizer.kind !== 'Raster') {
                continue;
            }

            const colorMap = propertyRecord(symbolizer, 'colorMap');
            const entries = recordArray(
                propertyRecord(colorMap, 'colorMapEntries'),
            );
            const stops = entries
                .map((entry): ColorStop | null => {
                    const quantity = Number(entry.quantity);
                    const color = parseCssColor(String(entry.color ?? ''));

                    if (!Number.isFinite(quantity) || !color) {
                        return null;
                    }

                    return { quantity, color };
                })
                .filter((entry): entry is ColorStop => entry !== null)
                .sort((left, right) => left.quantity - right.quantity);

            if (stops.length > 0) {
                return stops;
            }
        }
    }

    return [];
}

export function colorForValue(value: number, stops: ColorStop[]): Rgba {
    if (stops.length === 0) {
        return [0, 0, 0, 0];
    }

    if (value <= stops[0].quantity) {
        return stops[0].color;
    }

    for (let index = 1; index < stops.length; index += 1) {
        const lower = stops[index - 1];
        const upper = stops[index];

        if (value <= upper.quantity) {
            const span = upper.quantity - lower.quantity || 1;
            const ratio = (value - lower.quantity) / span;

            return [
                interpolate(lower.color[0], upper.color[0], ratio),
                interpolate(lower.color[1], upper.color[1], ratio),
                interpolate(lower.color[2], upper.color[2], ratio),
                interpolate(lower.color[3], upper.color[3], ratio),
            ];
        }
    }

    return stops[stops.length - 1].color;
}

async function readSldColorStops(
    sldText: string,
): Promise<{ colorStops: ColorStop[]; warning: string | null }> {
    try {
        const parser = new SLDParser();
        const response = await parser.readStyle(sldText);
        const colorStops = colorStopsFromGeoStylerStyle(response.output);

        if ((response.errors?.length ?? 0) > 0 || colorStops.length === 0) {
            return {
                colorStops,
                warning: 'style-fallback',
            };
        }

        return { colorStops, warning: null };
    } catch {
        return { colorStops: [], warning: 'style-fallback' };
    }
}

function valueRange(values: number[]): [number, number] {
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;

    for (const value of values) {
        if (!Number.isFinite(value)) {
            continue;
        }

        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        return [0, 1];
    }

    return minimum === maximum ? [minimum, minimum + 1] : [minimum, maximum];
}

function propertyRecord(
    value: unknown,
    property: string,
): Record<string, unknown> | unknown[] | null {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[property];

    if (isRecord(propertyValue) || Array.isArray(propertyValue)) {
        return propertyValue;
    }

    return null;
}

function recordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is Record<string, unknown> =>
              isRecord(entry),
          )
        : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseCssColor(color: string): Rgba | null {
    const hex = color.trim();

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        return [
            Number.parseInt(hex[1] + hex[1], 16),
            Number.parseInt(hex[2] + hex[2], 16),
            Number.parseInt(hex[3] + hex[3], 16),
            255,
        ];
    }

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
        return [
            Number.parseInt(hex.slice(1, 3), 16),
            Number.parseInt(hex.slice(3, 5), 16),
            Number.parseInt(hex.slice(5, 7), 16),
            255,
        ];
    }

    return null;
}

function interpolate(start: number, end: number, ratio: number): number {
    return Math.round(start + (end - start) * ratio);
}
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
bun test tests/Frontend/geotiff-map-preview.test.ts
```

Expected: all GeoTIFF map preview helper tests pass.

- [ ] **Step 6: Commit preview builder**

Run:

```bash
git add resources/js/lib/geotiff-map-preview.ts resources/js/types/geostyler-sld-parser.d.ts tests/Frontend/geotiff-map-preview.test.ts
git commit -m "feat: build geotiff canvas previews"
```

Expected: one commit containing preview builder and helper tests.

---

### Task 7: Add Map Result Preview Component

**Files:**
- Create: `resources/js/components/ogc/geotiff-map-result-preview.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`

- [ ] **Step 1: Add translations**

Add these Italian keys under `it.ogc` in `resources/js/lib/i18n/messages.ts`:

```ts
geotiffDownload: 'GeoTIFF',
mapPreviewLoading: 'Caricamento mappa',
mapPreviewUnavailable: 'Preview mappa non disponibile.',
mapPreviewUnsupportedBounds:
    'Il GeoTIFF non contiene coordinate geografiche visualizzabili.',
mapStyleFallback:
    'Lo stile SLD non e stato applicato completamente. La mappa usa uno stile fallback.',
sldDownload: 'SLD',
```

Add these English keys under `en.ogc`:

```ts
geotiffDownload: 'GeoTIFF',
mapPreviewLoading: 'Loading map',
mapPreviewUnavailable: 'Map preview unavailable.',
mapPreviewUnsupportedBounds:
    'The GeoTIFF does not contain displayable geographic coordinates.',
mapStyleFallback:
    'The SLD style was not fully applied. The map is using a fallback style.',
sldDownload: 'SLD',
```

- [ ] **Step 2: Create map preview component**

Create `resources/js/components/ogc/geotiff-map-result-preview.tsx`:

```tsx
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
import {
    buildGeoTiffMapPreview,
    type GeoTiffMapPreview,
} from '@/lib/geotiff-map-preview';
import { cn } from '@/lib/utils';
import { download, previewFile } from '@/routes/jobs/results';
import type { ProcessExecutionResult } from '@/types';
import { useTranslation } from '@/hooks/use-translation';

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
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
bunx tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 4: Commit map preview component**

Run:

```bash
git add resources/js/components/ogc/geotiff-map-result-preview.tsx resources/js/lib/i18n/messages.ts
git commit -m "feat: add geotiff map result card"
```

Expected: one commit containing component and translations.

---

### Task 8: Integrate Grouped Results On Job Detail Page

**Files:**
- Modify: `resources/js/pages/process-executions/show.tsx`
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Add source-level regression checks**

In `tests/Unit/ProcessUiLayoutTest.php`, add assertions to the existing job detail/source tests or add a focused test:

```php
test('job detail groups geotiff and sld results for map previews', function () {
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');

    expect($showSource)
        ->toContain('groupProcessResults(execution.results)')
        ->toContain('<GeoTiffMapResultPreview')
        ->toContain('visualResults.length')
        ->toContain('item.kind === \\'geotiff-map\\'');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter=groups
```

Expected: failure because `show.tsx` does not use grouped results yet.

- [ ] **Step 3: Update job detail imports**

In `resources/js/pages/process-executions/show.tsx`, add:

```tsx
import GeoTiffMapResultPreview from '@/components/ogc/geotiff-map-result-preview';
import { groupProcessResults } from '@/lib/ogc-result-groups';
```

- [ ] **Step 4: Compute visual results**

Inside `ProcessExecutionShow`, after destructuring props and before `return`, add:

```tsx
const visualResults = groupProcessResults(execution.results);
```

- [ ] **Step 5: Use visual count in the outputs section**

Replace output count references in the outputs `DetailSection` with `visualResults.length`:

```tsx
description={t(
    visualResults.length === 1
        ? 'ogc.outputCountOne'
        : 'ogc.outputCountMany',
    { count: visualResults.length },
)}
```

Replace the badge count with:

```tsx
{visualResults.length}
```

- [ ] **Step 6: Render grouped items**

Replace the existing `execution.results.map((result) => (...))` block with:

```tsx
{visualResults.map((item) =>
    item.kind === 'geotiff-map' ? (
        <GeoTiffMapResultPreview
            key={`map-${item.outputId}`}
            executionId={execution.id}
            title={item.title}
            description={item.description}
            geotiff={item.geotiff}
            sld={item.sld}
        />
    ) : (
        <ResultPreview
            key={item.result.id}
            executionId={execution.id}
            result={item.result}
        />
    ),
)}
```

Keep the empty-state condition based on `execution.results.length > 0`, because no stored results still means no outputs.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter=groups
bun test tests/Frontend/ogc-outputs.test.ts tests/Frontend/geotiff-map-preview.test.ts
bunx tsc --noEmit
```

Expected: all commands pass.

- [ ] **Step 8: Commit integration**

Run:

```bash
git add resources/js/pages/process-executions/show.tsx tests/Unit/ProcessUiLayoutTest.php
git commit -m "feat: render grouped geotiff map outputs"
```

Expected: one commit containing job detail integration.

---

### Task 9: Final Verification

**Files:**
- All modified files from previous tasks.

- [ ] **Step 1: Run PHP formatter**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: no PHP formatting drift remains.

- [ ] **Step 2: Run focused backend tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php tests/Unit/ProcessUiLayoutTest.php
```

Expected: all focused backend/unit tests pass.

- [ ] **Step 3: Run focused frontend tests**

Run:

```bash
bun test tests/Frontend/ogc-outputs.test.ts tests/Frontend/geotiff-map-preview.test.ts
```

Expected: all focused frontend tests pass.

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
bunx tsc --noEmit
```

Expected: TypeScript passes.

- [ ] **Step 5: Build frontend**

Run:

```bash
bun run build
```

Expected: Vite build passes and bundles MapLibre CSS and JS successfully.

- [ ] **Step 6: Confirm clean working tree**

Run:

```bash
git status --short
```

Expected: no uncommitted changes.
