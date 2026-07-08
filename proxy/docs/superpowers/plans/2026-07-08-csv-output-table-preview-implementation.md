# CSV Output Table Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render CSV process outputs as bounded table previews for both inline value results and cached reference results.

**Architecture:** Add a focused backend CSV preview builder that returns structured preview data. Store structured CSV previews for new value results, generate transient structured previews for already cached CSV files on job detail reads, and render structured rows in the React result preview. Full downloads remain routed through the existing result download endpoint.

**Tech Stack:** Laravel 13, PHP 8.4, Inertia Laravel 3, Pest 4, React 19, TypeScript, Bun tests, shadcn table components.

---

## Documentation Checkpoint

Laravel Boost documentation has already been checked for this plan:

- `application_info`: Laravel 13.19.0, Inertia Laravel 3.1.1, Pest 4.7.5, PHP 8.4.
- `search_docs`: queries `inertia testing assert props`, `storage fake local disk testing`, `pest dataset feature test`.
- Relevant guidance: use `Storage::fake()` for disk tests, `assertInertia()` / `inertiaProps()` for Inertia endpoint assertions, and Pest datasets for compact parser coverage.

If implementation starts in a fresh session, repeat the Boost documentation check before changing code.

## File Structure

- Create `app/Services/Ogc/CsvPreviewBuilder.php`: CSV-aware preview parsing, size limits, and structured preview shape.
- Create `tests/Unit/Ogc/CsvPreviewBuilderTest.php`: parser unit coverage independent of database state.
- Modify `app/Services/Ogc/OgcResultResponseParser.php`: use the builder for new `text/csv` value previews.
- Modify `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`: download value-backed structured CSV previews through `preview.data.source`.
- Modify `app/Http/Controllers/Ogc/ProcessExecutionController.php`: generate response-only CSV previews for cached historical CSV results.
- Modify `tests/Feature/Ogc/PollProcessExecutionJobTest.php`: assert structured CSV preview data for new stored CSV results.
- Modify `tests/Feature/Ogc/ProcessExecutionResultTest.php`: cover cached historical CSV previews and structured value-backed CSV downloads.
- Create `resources/js/lib/csv-preview.ts`: frontend normalization for structured CSV previews and legacy string fallback.
- Create `tests/Frontend/csv-preview.test.ts`: frontend parser and normalizer coverage.
- Modify `resources/js/components/ogc/result-preview.tsx`: render CSV tables from structured preview data.
- Modify `resources/js/lib/i18n/messages.ts`: add the truncated preview copy in Italian and English.
- Modify `tests/Unit/ProcessUiLayoutTest.php`: source-level guard that `ResultPreview` uses the CSV preview normalizer.

## Task 1: Backend CSV Preview Builder

**Files:**
- Create: `tests/Unit/Ogc/CsvPreviewBuilderTest.php`
- Create: `app/Services/Ogc/CsvPreviewBuilder.php`

- [ ] **Step 1: Generate the unit test file**

Run:

```bash
php artisan make:test --pest Ogc/CsvPreviewBuilderTest --unit --no-interaction
```

Expected: `tests/Unit/Ogc/CsvPreviewBuilderTest.php` exists.

- [ ] **Step 2: Replace the generated test with parser coverage**

Replace `tests/Unit/Ogc/CsvPreviewBuilderTest.php` with:

```php
<?php

use App\Services\Ogc\CsvPreviewBuilder;

test('it builds a structured preview for quoted csv data', function () {
    $preview = (new CsvPreviewBuilder)->fromString(
        "name,description,count\nEtna,\"gas, ash\",3\n\"Quote \"\"inside\"\"\",blank,\n",
    );

    expect($preview)->not->toBeNull()
        ->and($preview['headers'])->toBe(['name', 'description', 'count'])
        ->and($preview['rows'])->toBe([
            ['Etna', 'gas, ash', '3'],
            ['Quote "inside"', 'blank', ''],
        ])
        ->and($preview['truncated'])->toBeFalse()
        ->and($preview['source'])->toContain('gas, ash');
});

test('it preserves irregular rows without throwing', function () {
    $preview = (new CsvPreviewBuilder)->fromString(
        "a,b,c\n1,2\n3,4,5,6\n",
    );

    expect($preview)->not->toBeNull()
        ->and($preview['headers'])->toBe(['a', 'b', 'c'])
        ->and($preview['rows'])->toBe([
            ['1', '2'],
            ['3', '4', '5', '6'],
        ]);
});

test('it marks row-limited previews as truncated', function () {
    $lines = ['a,b'];

    foreach (range(1, 25) as $index) {
        $lines[] = "{$index},value {$index}";
    }

    $preview = (new CsvPreviewBuilder)->fromString(implode("\n", $lines)."\n");

    expect($preview)->not->toBeNull()
        ->and($preview['rows'])->toHaveCount(20)
        ->and($preview['truncated'])->toBeTrue();
});

test('it marks byte-limited previews as truncated', function () {
    $preview = (new CsvPreviewBuilder)->fromString('a,b'."\n".str_repeat('x', CsvPreviewBuilder::MaxBytes + 10));

    expect($preview)->not->toBeNull()
        ->and(strlen($preview['source']))->toBe(CsvPreviewBuilder::MaxBytes)
        ->and($preview['truncated'])->toBeTrue();
});
```

- [ ] **Step 3: Run the unit test to verify it fails**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/CsvPreviewBuilderTest.php
```

Expected: FAIL because `App\Services\Ogc\CsvPreviewBuilder` does not exist.

- [ ] **Step 4: Create the CSV preview builder**

Create `app/Services/Ogc/CsvPreviewBuilder.php`:

```php
<?php

namespace App\Services\Ogc;

class CsvPreviewBuilder
{
    public const int MaxBytes = 50000;

    public const int MaxDataRows = 20;

    /**
     * @return array{headers: array<int, string>, rows: array<int, array<int, string>>, truncated: bool, source: string}
     */
    public function fromString(string $csv): array
    {
        $source = substr($csv, 0, self::MaxBytes);
        $truncated = strlen($csv) > self::MaxBytes;
        $records = $this->records($source, self::MaxDataRows + 2, $truncated);

        if ($records === []) {
            return [
                'headers' => [],
                'rows' => [],
                'truncated' => $truncated,
                'source' => $source,
            ];
        }

        $headers = array_shift($records) ?? [];

        return [
            'headers' => $headers,
            'rows' => array_slice($records, 0, self::MaxDataRows),
            'truncated' => $truncated,
            'source' => $source,
        ];
    }

    /**
     * @return array<int, array<int, string>>
     */
    private function records(string $source, int $limit, bool &$truncated): array
    {
        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            return [];
        }

        fwrite($handle, $source);
        rewind($handle);

        $records = [];

        try {
            while (($record = fgetcsv($handle, escape: '')) !== false) {
                if ($record === [null]) {
                    continue;
                }

                $normalized = array_map(
                    fn (mixed $cell): string => $cell === null ? '' : (string) $cell,
                    $record,
                );

                if ($this->isEmptyRecord($normalized)) {
                    continue;
                }

                if (count($records) >= $limit) {
                    $truncated = true;
                    break;
                }

                $records[] = $normalized;
            }
        } finally {
            fclose($handle);
        }

        return $records;
    }

    /**
     * @param  array<int, string>  $record
     */
    private function isEmptyRecord(array $record): bool
    {
        foreach ($record as $cell) {
            if ($cell !== '') {
                return false;
            }
        }

        return true;
    }
}
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/CsvPreviewBuilderTest.php
```

Expected: PASS with 4 tests passing.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add app/Services/Ogc/CsvPreviewBuilder.php tests/Unit/Ogc/CsvPreviewBuilderTest.php
git commit -m "feat: add csv preview builder"
```

Expected: commit succeeds.

## Task 2: Structured CSV Storage And Value Downloads

**Files:**
- Modify: `app/Services/Ogc/OgcResultResponseParser.php`
- Modify: `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`
- Modify: `tests/Feature/Ogc/PollProcessExecutionJobTest.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Update the multipart CSV storage assertion**

In `tests/Feature/Ogc/PollProcessExecutionJobTest.php`, replace the final CSV assertions in `it stores each multipart result using process output definitions` with:

```php
        ->and($results['outfile']->preview['kind'])->toBe('csv')
        ->and($results['outfile']->preview['data']['headers'])->toBe(['length', 'gas'])
        ->and($results['outfile']->preview['data']['rows'])->toBe([
            ['0', '10'],
            ['1', '20'],
        ])
        ->and($results['outfile']->preview['data']['source'])->toContain('length,gas');
```

- [ ] **Step 2: Add a structured CSV value download test**

In `tests/Feature/Ogc/ProcessExecutionResultTest.php`, after `users can download cached text and csv value results without a stored file`, add:

```php
test('users can download structured csv value results without a stored file', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => '4066039d-793d-11f1-9692-3b828b09e202',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'table',
        'media_type' => 'text/csv',
        'storage_path' => null,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => 'csv',
            'data' => [
                'headers' => ['a', 'b'],
                'rows' => [['1', '2']],
                'truncated' => false,
                'source' => "a,b\n1,2\n",
            ],
        ],
    ]);

    $this->actingAs($user)
        ->get("/jobs/{$execution->id}/results/{$result->id}/download")
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=utf-8')
        ->assertHeader('content-disposition', 'attachment; filename="4066039d-793d-11f1-9692-3b828b09e202_table.csv"')
        ->assertContent("a,b\n1,2\n");
});
```

- [ ] **Step 3: Run focused tests to verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php --filter="stores each multipart result"
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="structured csv value"
```

Expected: first command FAILS because CSV preview data is still a string. Second command FAILS with a 404 from the download route because structured `preview.data` is not yet converted to text.

- [ ] **Step 4: Inject CsvPreviewBuilder into the result response parser**

In `app/Services/Ogc/OgcResultResponseParser.php`, change the constructor to:

```php
    public function __construct(
        private OgcProcessesClient $client,
        private CsvPreviewBuilder $csvPreviewBuilder,
    ) {}
```

In the same file, replace the CSV branch in `preview()` with:

```php
        if ($mediaType === 'text/csv') {
            return ['kind' => 'csv', 'data' => $this->csvPreviewBuilder->fromString($body)];
        }
```

- [ ] **Step 5: Preserve structured CSV downloads**

In `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`, replace the CSV branch in `previewResponse()` with:

```php
        if ($previewKind === 'csv' && $mediaType === 'text/csv') {
            return $this->previewTextResponse(
                $processExecution,
                $result,
                $this->previewTextData($previewData),
                'csv',
            );
        }
```

Add this private method before `previewTextResponse()`:

```php
    private function previewTextData(mixed $previewData): mixed
    {
        if (is_array($previewData) && array_key_exists('source', $previewData)) {
            return $previewData['source'];
        }

        return $previewData;
    }
```

- [ ] **Step 6: Run focused tests to verify they pass**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php --filter="stores each multipart result"
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="structured csv value"
```

Expected: both commands PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add app/Services/Ogc/OgcResultResponseParser.php app/Http/Controllers/Ogc/ProcessExecutionResultController.php tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "feat: store structured csv previews"
```

Expected: commit succeeds.

## Task 3: Cached Historical CSV Preview On Job Detail Reads

**Files:**
- Modify: `app/Http/Controllers/Ogc/ProcessExecutionController.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Add the cached historical CSV feature test**

In `tests/Feature/Ogc/ProcessExecutionResultTest.php`, after `users can view their execution detail`, add:

```php
test('users can view table previews for existing cached csv results', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $path = "ogc-results/{$execution->id}/table.csv";

    ProcessExecutionResult::factory()->for($execution)->create([
        'output_id' => 'table',
        'title' => 'Table output',
        'media_type' => 'text/csv',
        'storage_path' => $path,
        'cache_status' => ResultCacheStatus::Cached,
        'preview' => [
            'kind' => 'binary',
            'data' => ['mediaType' => 'text/csv'],
        ],
    ]);

    Storage::disk('local')->put($path, "name,description\nEtna,\"gas, ash\"\n");

    $response = $this->actingAs($user)
        ->get("/jobs/{$execution->id}")
        ->assertOk();

    expect($response->inertiaProps('execution.results.0.preview'))->toMatchArray([
        'kind' => 'csv',
        'data' => [
            'headers' => ['name', 'description'],
            'rows' => [['Etna', 'gas, ash']],
            'truncated' => false,
        ],
    ]);
});
```

- [ ] **Step 2: Run the feature test to verify it fails**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="existing cached csv"
```

Expected: FAIL because `execution.results.0.preview.kind` is still `binary`.

- [ ] **Step 3: Add imports for response-time CSV normalization**

In `app/Http/Controllers/Ogc/ProcessExecutionController.php`, add these imports:

```php
use App\Models\ProcessExecutionResult;
use App\Services\Ogc\CsvPreviewBuilder;
use Illuminate\Support\Facades\Storage;
```

- [ ] **Step 4: Inject CsvPreviewBuilder into the show action**

Change the `show()` signature in `app/Http/Controllers/Ogc/ProcessExecutionController.php` to:

```php
    public function show(
        Request $request,
        ProcessExecution $processExecution,
        FindGeoTiffSldResultPairs $findGeoTiffSldResultPairs,
        SldVisualizationInspector $sldVisualizationInspector,
        CsvPreviewBuilder $csvPreviewBuilder,
    ): Response {
```

- [ ] **Step 5: Use normalized previews in the result payload**

In the result mapping inside `show()`, change the map callback to type the result and replace the `preview` value:

```php
            'results' => $processExecution->results->map(fn (ProcessExecutionResult $result): array => [
                'id' => $result->id,
                'outputId' => $result->output_id,
                'title' => $result->title,
                'description' => $result->description,
                'mediaType' => $result->media_type,
                'cacheStatus' => $result->cache_status->value,
                'preview' => $this->previewForResult($result, $csvPreviewBuilder),
                'mapLayer' => [
                    'type' => $result->map_layer_type,
                    'status' => $result->map_layer_status?->value,
                    'name' => $result->map_layer_name,
                    'styleName' => $result->map_style_name,
                    'bounds' => $result->map_layer_bounds,
                    'publishedAt' => $result->map_layer_published_at?->toIso8601String(),
                    'error' => $result->map_layer_error,
                    'warning' => $mapLayerWarnings[$result->id] ?? null,
                ],
            ])->all(),
```

- [ ] **Step 6: Add private preview helpers**

Add these methods near the existing private methods in `ProcessExecutionController`:

```php
    /**
     * @return array<string, mixed>|null
     */
    private function previewForResult(ProcessExecutionResult $result, CsvPreviewBuilder $csvPreviewBuilder): ?array
    {
        $preview = $result->preview;

        if ($this->baseMediaType($result->media_type) !== 'text/csv') {
            return $preview;
        }

        if ($this->hasStructuredCsvPreview($preview)) {
            return $preview;
        }

        if (blank($result->storage_path) || ! Storage::disk('local')->exists((string) $result->storage_path)) {
            return $preview;
        }

        return [
            'kind' => 'csv',
            'data' => $csvPreviewBuilder->fromString(
                Storage::disk('local')->get((string) $result->storage_path),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $preview
     */
    private function hasStructuredCsvPreview(?array $preview): bool
    {
        $data = data_get($preview, 'data');

        return data_get($preview, 'kind') === 'csv'
            && is_array($data)
            && is_array($data['headers'] ?? null)
            && is_array($data['rows'] ?? null);
    }

    private function baseMediaType(?string $mediaType): string
    {
        return str((string) $mediaType)
            ->before(';')
            ->trim()
            ->lower()
            ->toString();
    }
```

- [ ] **Step 7: Run the feature test to verify it passes**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="existing cached csv"
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add app/Http/Controllers/Ogc/ProcessExecutionController.php tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "feat: preview cached csv results"
```

Expected: commit succeeds.

## Task 4: Frontend CSV Preview Normalization And Rendering

**Files:**
- Create: `resources/js/lib/csv-preview.ts`
- Create: `tests/Frontend/csv-preview.test.ts`
- Modify: `resources/js/components/ogc/result-preview.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Add frontend CSV normalizer tests**

Create `tests/Frontend/csv-preview.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import { normalizeCsvPreview } from '../../resources/js/lib/csv-preview';

describe('normalizeCsvPreview', () => {
    test('normalizes structured preview payloads', () => {
        const preview = normalizeCsvPreview({
            headers: ['a', 'b'],
            rows: [['1', '2']],
            truncated: true,
            source: 'a,b\n1,2\n',
        });

        expect(preview).toEqual({
            headers: ['a', 'b'],
            rows: [['1', '2']],
            truncated: true,
            columnCount: 2,
        });
    });

    test('pads irregular structured rows to a stable column count', () => {
        const preview = normalizeCsvPreview({
            headers: ['a'],
            rows: [['1', '2'], ['3']],
            truncated: false,
        });

        expect(preview).toEqual({
            headers: ['a', ''],
            rows: [
                ['1', '2'],
                ['3', ''],
            ],
            truncated: false,
            columnCount: 2,
        });
    });

    test('parses legacy string previews with quoted commas', () => {
        const preview = normalizeCsvPreview(
            'name,description\nEtna,"gas, ash"\n"Quote ""inside""",blank\n',
        );

        expect(preview).toEqual({
            headers: ['name', 'description'],
            rows: [
                ['Etna', 'gas, ash'],
                ['Quote "inside"', 'blank'],
            ],
            truncated: false,
            columnCount: 2,
        });
    });

    test('returns null for empty preview data', () => {
        expect(normalizeCsvPreview({ headers: [], rows: [] })).toBeNull();
        expect(normalizeCsvPreview('')).toBeNull();
        expect(normalizeCsvPreview(null)).toBeNull();
    });
});
```

- [ ] **Step 2: Add a source-level guard for ResultPreview**

In `tests/Unit/ProcessUiLayoutTest.php`, add this test near the existing result preview source tests:

```php
test('csv result previews use structured normalization instead of comma splitting in the component', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/result-preview.tsx');

    expect($source)
        ->toContain("import { normalizeCsvPreview } from '@/lib/csv-preview'")
        ->toContain('const csv = normalizeCsvPreview(data)')
        ->not->toContain("row.split(',')");
});
```

- [ ] **Step 3: Run frontend tests to verify failure**

Run:

```bash
bun test tests/Frontend/csv-preview.test.ts
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="csv result previews"
```

Expected: first command FAILS because `resources/js/lib/csv-preview.ts` does not exist. Second command FAILS because `ResultPreview` still splits rows by comma.

- [ ] **Step 4: Create the frontend CSV preview normalizer**

Create `resources/js/lib/csv-preview.ts`:

```ts
type CsvPreviewRecord = Record<string, unknown>;

export type CsvPreviewTable = {
    headers: string[];
    rows: string[][];
    truncated: boolean;
    columnCount: number;
};

const maxLegacyRows = 20;

export function normalizeCsvPreview(data: unknown): CsvPreviewTable | null {
    if (isRecord(data)) {
        const headers = stringArray(data.headers);
        const rows = rowArray(data.rows);

        if (headers && rows) {
            return tableFromRecords(headers, rows, data.truncated === true);
        }
    }

    if (typeof data === 'string') {
        return normalizeCsvSource(data);
    }

    return null;
}

function normalizeCsvSource(source: string): CsvPreviewTable | null {
    const records = parseCsvRecords(source).filter((record) =>
        record.some((cell) => cell !== ''),
    );

    if (records.length === 0) {
        return null;
    }

    const [headers, ...rows] = records;
    const limitedRows = rows.slice(0, maxLegacyRows);

    return tableFromRecords(
        headers,
        limitedRows,
        rows.length > maxLegacyRows,
    );
}

function parseCsvRecords(source: string): string[][] {
    const records: string[][] = [];
    let record: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (inQuotes) {
            if (character === '"') {
                if (source[index + 1] === '"') {
                    cell += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += character;
            }

            continue;
        }

        if (character === '"') {
            inQuotes = true;
            continue;
        }

        if (character === ',') {
            record.push(cell);
            cell = '';
            continue;
        }

        if (character === '\n') {
            record.push(cell);
            records.push(record);
            record = [];
            cell = '';
            continue;
        }

        if (character === '\r') {
            continue;
        }

        cell += character;
    }

    if (cell !== '' || record.length > 0) {
        record.push(cell);
        records.push(record);
    }

    return records;
}

function tableFromRecords(
    headers: string[],
    rows: string[][],
    truncated: boolean,
): CsvPreviewTable | null {
    const columnCount = Math.max(
        headers.length,
        ...rows.map((row) => row.length),
    );

    if (columnCount === 0) {
        return null;
    }

    return {
        headers: padRow(headers, columnCount),
        rows: rows.map((row) => padRow(row, columnCount)),
        truncated,
        columnCount,
    };
}

function padRow(row: string[], columnCount: number): string[] {
    return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
}

function stringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    return value.map((item) => String(item ?? ''));
}

function rowArray(value: unknown): string[][] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    return value.map((row) => (Array.isArray(row) ? stringArray(row) : null)).filter(
        (row): row is string[] => row !== null,
    );
}

function isRecord(value: unknown): value is CsvPreviewRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 5: Add translated truncated preview copy**

In `resources/js/lib/i18n/messages.ts`, add this key to both `ogc` message objects:

```ts
csvPreviewTruncated:
    'Anteprima limitata alle prime righe. Scarica il CSV per il file completo.',
```

and:

```ts
csvPreviewTruncated:
    'Preview limited to the first rows. Download the CSV for the full file.',
```

- [ ] **Step 6: Update ResultPreview CSV rendering**

In `resources/js/components/ogc/result-preview.tsx`, add this import:

```ts
import { normalizeCsvPreview } from '@/lib/csv-preview';
```

Replace the current `CsvPreview` function with:

```tsx
function CsvPreview({ data }: { data: unknown }) {
    const { t } = useTranslation();
    const csv = normalizeCsvPreview(data);

    if (!csv) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('ogc.previewUnavailable')}
            </p>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        {csv.headers.map((cell, index) => (
                            <TableHead key={index}>{cell}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {csv.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex}>{cell}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {csv.truncated ? (
                <p className="text-xs text-muted-foreground">
                    {t('ogc.csvPreviewTruncated')}
                </p>
            ) : null}
        </div>
    );
}
```

- [ ] **Step 7: Run frontend focused tests**

Run:

```bash
bun test tests/Frontend/csv-preview.test.ts
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="csv result previews"
```

Expected: both commands PASS.

- [ ] **Step 8: Run TypeScript check**

Run:

```bash
bunx tsc --noEmit
```

Expected: PASS with exit code 0.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add resources/js/lib/csv-preview.ts tests/Frontend/csv-preview.test.ts resources/js/components/ogc/result-preview.tsx resources/js/lib/i18n/messages.ts tests/Unit/ProcessUiLayoutTest.php
git commit -m "feat: render structured csv previews"
```

Expected: commit succeeds.

## Task 5: Formatting And Final Verification

**Files:**
- Verify: all files changed by Tasks 1 through 4.

- [ ] **Step 1: Format PHP changes**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: exits 0. If Pint changes files, commit those formatting changes with the affected task files.

- [ ] **Step 2: Run backend focused tests**

Run:

```bash
php artisan test --compact tests/Unit/Ogc/CsvPreviewBuilderTest.php
php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php --filter="stores each multipart result"
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter="csv"
```

Expected: all commands PASS.

- [ ] **Step 3: Run frontend focused tests and typecheck**

Run:

```bash
bun test tests/Frontend/csv-preview.test.ts
bunx tsc --noEmit
```

Expected: both commands PASS.

- [ ] **Step 4: Run final status check**

Run:

```bash
git status --short
```

Expected: no unstaged or uncommitted implementation changes remain after the final commit.
