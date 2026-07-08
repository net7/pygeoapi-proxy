# CSV Output Table Preview Design

## Objective

Render CSV process outputs as tables in the job detail page.

The table preview must appear for both CSV delivery modes:

- inline value results, where the CSV content is already stored in `preview`;
- referenced results, where the CSV file has been cached under `storage_path`.

Existing jobs with cached CSV files must show the table immediately when the job detail page is opened. No backfill command is required for the first implementation.

## Current State

The application stores process outputs as `ProcessExecutionResult` records and exposes them to the job detail page through `ProcessExecutionController::show()`.

`ResultPreview` already branches on `preview.kind`. For `preview.kind === 'csv'`, it currently renders a table by converting `preview.data` to a string, splitting by newline, and then splitting each row by comma.

That implementation is only a rough preview. It breaks on valid CSV features such as quoted cells, commas inside quoted cells, escaped quotes, and irregular rows. It also only works when the result already carries a CSV preview. Cached reference CSV files with binary previews still show "preview unavailable" even though the file is available on disk.

## Decisions

### Generate CSV Preview On Read For Cached Files

Use the approved approach: generate a CSV preview on read for cached `text/csv` results when the stored preview is missing, binary, or still in the old raw-string format.

This lets existing jobs show table previews immediately without a migration, batch command, or data rewrite.

The generated preview is part of the Inertia response for the job detail page. It does not need to be persisted during page rendering.

### Keep Downloads Unchanged

The existing download route remains the source for full CSV downloads.

The preview is a limited rendering aid, not a replacement for the full file. `ProcessExecutionResultController::download()` keeps returning the stored file or preview-backed value response with the same authorization and `Content-Disposition: attachment` behavior.

### Use Structured Preview Data

CSV previews should use a structured payload instead of raw CSV text as the primary format.

The target shape is:

```json
{
  "headers": ["column_a", "column_b"],
  "rows": [["1", "2"], ["3", "4"]],
  "truncated": false,
  "source": "column_a,column_b\n1,2\n3,4\n"
}
```

The first CSV row is treated as the header row when present. Remaining rows are table body rows.

`source` contains the bounded CSV text used to build the preview. The frontend must not render `source`, but the download controller can use it for value-backed CSV results that do not have a stored file. This preserves the current route behavior while allowing the UI to render structured data.

If the CSV has no rows, the preview is unavailable.

If rows have different cell counts, the renderer should preserve the parsed cells and avoid throwing. Missing cells render blank.

### Limit Preview Size

The preview must stay bounded.

The parser should only inspect a limited amount of CSV text, aligned with the current 50 KB preview limit, and should expose 20 data rows plus the header row.

If the source exceeds the limit or more rows exist than are exposed, set `truncated: true`.

### Backward Compatibility

The frontend should keep a fallback path for old raw-string CSV previews so older records still render if they already carry `preview.kind = csv` with string data.

The main path should be structured data. The fallback should not remain the only CSV parser path.

## Backend Design

### CSV Preview Builder

Add a small backend helper dedicated to CSV preview generation.

Responsibilities:

- accept CSV text;
- parse it with CSV-aware behavior, not manual comma splitting;
- return headers, rows, `truncated`, and the bounded `source` text;
- handle quoted values, escaped quotes, blank cells, commas inside quoted cells, and line endings consistently;
- enforce the preview byte and row limits.

The helper should be easy to unit test without requiring a full process execution.

### Result Parsing For New Inline CSV Results

`OgcResultResponseParser::preview()` should use the CSV preview builder when `mediaType === 'text/csv'`.

New inline CSV results should be stored with:

```php
[
    'kind' => 'csv',
    'data' => [
        'headers' => [...],
        'rows' => [...],
        'truncated' => true|false,
        'source' => '...',
    ],
]
```

`ProcessExecutionResultController::download()` should keep supporting value-backed CSV downloads by reading `preview.data.source` when the result has no stored file. If a legacy result still has scalar CSV data, the current scalar path remains valid.

### Result Exposure For Existing Cached CSV Results

`ProcessExecutionController::show()` should normalize the preview it sends to the frontend.

For each result:

1. if the media type base is `text/csv`;
2. and the result has a readable `storage_path`;
3. and the stored preview is missing, binary, or not already structured CSV data;
4. then read the cached file from the local disk and generate a transient CSV preview for the response.

This normalization is response-only. It should not mutate the result record.

If the file cannot be read, leave preview unavailable and keep the download action.

## Frontend Design

### ResultPreview

`ResultPreview` keeps using `preview.kind === 'csv'` to choose the CSV table renderer.

The CSV renderer should accept structured data:

- `headers` render as table heads;
- `rows` render as table body rows;
- `source` is ignored by the renderer;
- missing cells render as empty cells so irregular rows do not break layout;
- extra cells render in extra columns if present.

If the preview is empty or invalid, show the existing "preview unavailable" copy.

If `truncated` is true, show a compact note that only a preview is displayed and the full CSV is available through the download button.

### Legacy String Fallback

For old preview payloads where `preview.data` is a string, the frontend can parse enough to render a best-effort table. This is only a compatibility path.

The preferred behavior for existing cached files is server-side preview generation, so users should normally receive structured data even for old jobs.

## Data Flow

### New Inline CSV Result

1. OGC response body contains CSV content.
2. `OgcResultResponseParser` detects `text/csv`.
3. The CSV preview builder creates structured preview data.
4. The result is stored with `preview.kind = csv`.
5. The job detail page renders the structured preview as a table.

### Existing Cached CSV Result

1. A stored result has `media_type = text/csv` and `storage_path`.
2. The job detail page is requested.
3. `ProcessExecutionController::show()` detects that the preview needs normalization.
4. Laravel reads the cached file and builds a transient structured preview.
5. The Inertia response contains the structured preview.
6. `ResultPreview` renders the table immediately.

## Error Handling

If the cached file is missing or unreadable, the page should not fail. The result keeps its download button when available, and the preview area shows unavailable state.

If CSV parsing encounters irregular rows, the preview should render the parsed cells instead of failing the whole result.

If the file is larger than the preview limit, parse only the bounded preview text and mark the preview as truncated.

If the CSV is empty, show preview unavailable.

## Testing

### Backend

Add tests for the CSV preview builder:

- parses simple comma-separated rows;
- handles quoted cells with commas;
- handles escaped quotes;
- handles blank cells;
- preserves irregular rows without throwing;
- marks previews truncated when the row or byte limit is exceeded.

Add a feature test for existing cached CSV results:

- create a `ProcessExecutionResult` with `media_type = text/csv`, `storage_path`, and a missing or binary preview;
- store a CSV file on the fake local disk;
- request the job detail page;
- assert that `execution.results.0.preview.kind` is `csv`;
- assert that the preview data contains headers and rows.

Keep the existing download tests unchanged unless the preview shape requires a compatibility adjustment for value-backed CSV downloads.

### Frontend

Add or update frontend tests so CSV rendering uses structured preview data.

Tests should verify that the source no longer depends on the primary `row.split(',')` path for CSV table rendering and that structured headers/rows are supported.

## Non-Goals

- Do not add a CSV backfill command in this scope.
- Do not persist response-time preview normalization.
- Do not replace the download route.
- Do not implement pagination, sorting, filtering, or column type inference for CSV previews.
- Do not fetch CSV files from the browser just to build previews.
