# CONDUIT CSV Output Service Integration Design

## Objective

Integrate the CONDUIT service change for the `outfile` output.

The service now returns a real CSV for `outfile`, with:

- comma-separated values;
- a header row;
- standard scientific notation using `E` instead of Fortran-style `D`;
- a CSV media type that may include header metadata, for example `text/csv; header=present`.

The proxy must preserve and preview this result correctly without adding legacy conversion logic for old space-delimited text outputs.

## Current State

CONDUIT is already described in the cached process fixture with `outfile` as `text/csv`. The proxy requests this output by reference because tabular/file outputs are not considered inline value outputs by `ProcessOutputRequestBuilder`.

CSV table preview support already exists:

- `CsvPreviewBuilder` parses CSV content into structured preview data;
- `OgcResultResponseParser` creates structured previews for inline `text/csv` bodies;
- `ProcessExecutionController::show()` can build a transient structured preview from cached CSV files;
- `ProcessExecutionResultController::download()` uses the stored file when available and falls back to preview source for value-backed CSV results.

The main integration risk is media type handling. Some code paths use a base media type, while others may keep the full header value. The new service output can expose `text/csv; header=present`, so CSV detection must be based on the base media type while preserving the full value where it is useful metadata.

## Decisions

### Support The New Service Contract

The proxy will support the new `outfile` contract as the canonical behavior:

- `outfile` is CSV;
- the first row is treated as the header row;
- numeric values are displayed as provided by the service, including scientific notation with `E`;
- the downloaded file uses a `.csv` extension.

The proxy will not rewrite service output values, replace exponent markers, infer missing headers, or transform space-delimited legacy text into CSV.

### Preserve Full Media Type Metadata

When a remote result response includes `Content-Type: text/csv; header=present`, the stored `media_type` should keep that complete value.

Consumers that need behavior decisions should use the base media type:

- CSV preview detection: `text/csv`;
- filename extension: `.csv`;
- download fallback decisions: `text/csv`;
- result list preview normalization: `text/csv` or CSV-looking path.

This keeps the service's `header=present` metadata available without making exact-string comparisons brittle.

### Keep Reference Delivery

`outfile` should remain requested by reference.

The current behavior is appropriate because `outfile` is a downloadable tabular result. Preview is generated from the cached file on the job detail response, so users still see a table without making the service return the whole file inline.

### Keep Legacy Compatibility Lightweight

Existing jobs with cached CSV files should continue to preview if the file path or media type identifies them as CSV.

Old `text/plain` space-delimited `outfile` results are not converted in this scope. They remain text outputs/downloads as stored.

## Backend Design

### Result Parsing

`OgcResultResponseParser` should treat CSV using the base media type instead of exact full media type equality.

For inline CSV bodies, `preview()` should build a structured CSV preview when the base media type is `text/csv`, including cases like:

```text
text/csv; header=present
text/csv; header=absent
```

The existing `CsvPreviewBuilder` remains responsible for parsing and limiting preview data.

### Remote Result Caching

`StoreProcessResult` already downloads referenced result files and stores the response body locally.

When a remote CSV response carries `Content-Type: text/csv; header=present`, the cached `ProcessExecutionResult` should keep that full media type. `ResultFileName::forOutput()` already derives `.csv` from the base media type.

The stored file body should be the service body unchanged.

### Job Detail Preview

`ProcessExecutionController::show()` already normalizes cached CSV results at response time. That behavior should continue to work for full media types with parameters because it already strips parameters before deciding whether a result is CSV.

The generated preview should expose:

```json
{
  "headers": ["..."],
  "rows": [["..."]],
  "truncated": false,
  "source": "..."
}
```

No database mutation is required when building this preview.

### Download Behavior

Downloads should keep returning the cached file with:

- `Content-Type` based on the stored media type;
- `Content-Disposition: attachment`;
- a filename ending in `.csv`.

For value-backed CSV results without a stored file, the existing preview-source fallback remains valid.

## Data Flow

1. CONDUIT completes and exposes `outfile` as a referenced CSV result.
2. The proxy downloads the referenced result.
3. The proxy stores the body unchanged under an `.csv` filename.
4. The result record keeps the full media type, for example `text/csv; header=present`.
5. The job detail page detects the cached result as CSV from the base media type.
6. The CSV preview builder parses the first row as headers and returns structured preview data.
7. The frontend renders the existing CSV table preview.
8. Download returns the original cached CSV file.

## Error Handling

If the cached file is missing or unreadable, the job detail page should not fail. The result keeps its existing preview state and download behavior.

If the CSV contains irregular rows, the existing CSV preview behavior preserves parsed cells and avoids throwing.

If the CSV is larger than the preview limit, the preview is truncated while the full download remains available.

## Testing

Add or update backend tests for the new CONDUIT `outfile` behavior:

- multipart `outfile` with `Content-Type: text/csv; header=present` is recognized as CSV;
- preview data contains the header row and parsed data rows;
- a value such as `1.23E-04` is preserved unchanged in the preview;
- referenced `outfile` downloads with `text/csv; header=present` are cached under a `.csv` filename;
- job detail preview generation works for cached CSV results with media type parameters.

Run the affected Laravel tests inside the Docker `laravel` service, then run Pint for PHP formatting if PHP files are changed.

## Non-Goals

- Do not convert legacy space-delimited TXT outputs into CSV.
- Do not replace `D` exponent markers in proxy code.
- Do not add a backfill command or migration for existing jobs.
- Do not change the CONDUIT output transmission mode from reference to value.
- Do not add frontend UI changes unless tests show the existing CSV table path no longer handles the structured preview.
