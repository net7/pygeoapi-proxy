# CONDUIT CSV Output Service Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and preview the new CONDUIT `outfile` CSV output, including `text/csv; header=present` media type metadata and standard `E` scientific notation.

**Architecture:** Keep behavior decisions based on base media types while preserving the full CSV media type on stored results. Existing CSV preview and download code remains the main path; the parser gets a narrow media-type separation so CSV parameters are not lost.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Laravel HTTP fakes, Docker Compose `laravel` service.

---

## File Structure

- Modify `app/Services/Ogc/OgcResultResponseParser.php`
  - Responsibility: parse OGC result responses into normalized result payloads.
  - Change: separate stored result media type from base media type used for JSON/CSV/text decisions.
- Modify `tests/Feature/Ogc/PollProcessExecutionJobTest.php`
  - Responsibility: feature coverage for polling remote jobs and storing result records.
  - Change: make the CONDUIT multipart CSV test use `text/csv; header=present`, a header row, and `E` scientific notation; assert full media type preservation.
- Modify `tests/Feature/Ogc/ProcessExecutionResultTest.php`
  - Responsibility: feature coverage for job detail previews and result downloads.
  - Change: cover cached CSV preview and on-demand remote CSV download when stored media type contains `header=present`.

## Prerequisite

- [ ] **Step 1: Confirm Laravel docs context before code edits**

Use Laravel Boost `search-docs` with these queries and packages:

```text
packages: ["laravel/framework", "pestphp/pest"]
queries: ["http response header testing", "http fake response headers", "pest feature tests"]
```

Expected: version-specific Laravel/Pest docs are available before editing tests or PHP code.

## Task 1: Add The Failing CONDUIT Multipart CSV Test

**Files:**
- Modify: `tests/Feature/Ogc/PollProcessExecutionJobTest.php`

- [ ] **Step 1: Replace the existing multipart CONDUIT CSV test setup and expectations**

In `tests/Feature/Ogc/PollProcessExecutionJobTest.php`, edit the test named `it stores each multipart result using process output definitions`.

Replace the `outfile` multipart part in `$body` with:

```php
'Content-Disposition: form-data; name="outfile"; filename="outfile.csv"',
'Content-Type: text/csv; header=present',
'',
"length,gas\r\n0,1.23E-04\r\n1,2.50E+01\r\n",
```

Then replace the `outfile` expectations with:

```php
->and($results['outfile']->title)->toBe('Table of output variables')
->and($results['outfile']->media_type)->toBe('text/csv; header=present')
->and($results['outfile']->preview['kind'])->toBe('csv')
->and($results['outfile']->preview['data']['headers'])->toBe(['length', 'gas'])
->and($results['outfile']->preview['data']['rows'])->toBe([
    ['0', '1.23E-04'],
    ['1', '2.50E+01'],
])
->and($results['outfile']->preview['data']['source'])->toContain('length,gas')
->and($results['outfile']->preview['data']['source'])->toContain('1.23E-04');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
docker compose --env-file .env.develop -f compose.yaml -f compose.develop.yaml exec laravel php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php --filter='it stores each multipart result using process output definitions'
```

Expected: FAIL because the stored `media_type` is currently `text/csv` instead of `text/csv; header=present`.

- [ ] **Step 3: Commit is not allowed yet**

Do not commit after the red test. Continue to Task 2.

## Task 2: Preserve CSV Media Type Parameters In The Parser

**Files:**
- Modify: `app/Services/Ogc/OgcResultResponseParser.php`
- Test: `tests/Feature/Ogc/PollProcessExecutionJobTest.php`

- [ ] **Step 1: Update top-level response parsing to keep a stored result media type**

In `OgcResultResponseParser::parse()`, keep `$mediaType` as the base media type for control flow, and add `$resultMediaType` for stored result metadata.

Use this opening block:

```php
public function parse(ProcessExecution $execution, Response $response, ?string $outputId = null): array
{
    $contentType = (string) $response->header('Content-Type');
    $mediaType = $this->mediaType($contentType);
    $resultMediaType = $this->resultMediaType($contentType);

    if (! str_starts_with($mediaType, 'multipart/')) {
        $jsonResults = $this->resultsFromJsonBody(
            execution: $execution,
            body: $response->body(),
            mediaType: $mediaType ?: 'application/json',
            outputId: $outputId,
        );

        if ($jsonResults !== null) {
            return $jsonResults;
        }

        return [$this->resultFromBody(
            execution: $execution,
            outputId: $outputId ?? $this->firstRequestedOutputId($execution),
            body: $response->body(),
            mediaType: $resultMediaType ?: 'application/json',
            forceStorage: false,
        )];
    }
```

Leave the rest of `parse()` unchanged after this opening block.

- [ ] **Step 2: Update multipart part parsing to pass the stored result media type**

In `OgcResultResponseParser::resultsFromPart()`, replace the media type initialization with:

```php
$contentType = $headers['content-type'] ?? '';
$mediaType = $this->mediaType($contentType);
$resultMediaType = $this->resultMediaType($contentType);
$body = $part['body'];
```

In the empty `Content-Location` link branch, pass the result media type:

```php
return [$this->resultFromLinkValue($execution, $outputId, [
    'href' => $contentLocation,
    'type' => $resultMediaType ?: $this->outputMediaType($execution, $outputId),
])];
```

In the final `resultFromBody()` call, pass the result media type:

```php
return [$this->resultFromBody(
    execution: $execution,
    outputId: $outputId,
    body: $body,
    mediaType: $resultMediaType,
    forceStorage: true,
)];
```

- [ ] **Step 3: Make `resultFromBody()` preview with the base media type**

In `OgcResultResponseParser::resultFromBody()`, replace the media type and preview setup with:

```php
$processOutputs = $execution->process_outputs ?? [];
$outputSpec = $processOutputs[$outputId] ?? [];
$mediaType = $mediaType ?: $this->outputMediaType($execution, $outputId);
$mediaType = $mediaType ?: 'application/octet-stream';
$preview = $this->preview($mediaType, $body);
$storageBody = $forceStorage && $preview['kind'] === 'binary' ? $body : null;
```

- [ ] **Step 4: Make `preview()` use base media type decisions**

In `OgcResultResponseParser::preview()`, add a base media type variable immediately after JSON handling and use it for CSV/text decisions:

```php
private function preview(string $mediaType, string $body): array
{
    $json = $this->json($body);

    if (is_array($json) && isset($json['chartType'], $json['domain'], $json['series'])) {
        return ['kind' => 'chart', 'data' => $json];
    }

    if (is_array($json)) {
        return ['kind' => 'json', 'data' => $json];
    }

    $baseMediaType = $this->mediaType($mediaType);

    if ($baseMediaType === 'text/csv') {
        return ['kind' => 'csv', 'data' => $this->csvPreviewBuilder->fromString($body)];
    }

    if (str_starts_with($baseMediaType, 'text/')) {
        return ['kind' => 'text', 'data' => str($body)->limit(50000)->toString()];
    }

    return [
        'kind' => 'binary',
        'data' => [
            'mediaType' => $baseMediaType ?: $mediaType,
            'sizeBytes' => strlen($body),
        ],
    ];
}
```

- [ ] **Step 5: Add the result media type helper**

Add this private method near the existing `mediaType()` and `linkMediaType()` helpers:

```php
private function resultMediaType(string $contentType): string
{
    $baseMediaType = $this->mediaType($contentType);

    if ($baseMediaType === 'text/csv') {
        return Str::of($contentType)->trim()->lower()->toString();
    }

    return $baseMediaType;
}
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
docker compose --env-file .env.develop -f compose.yaml -f compose.develop.yaml exec laravel php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php --filter='it stores each multipart result using process output definitions'
```

Expected: PASS.

- [ ] **Step 7: Commit the parser change**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
git add proxy/app/Services/Ogc/OgcResultResponseParser.php proxy/tests/Feature/Ogc/PollProcessExecutionJobTest.php
git commit -m "Preserve CONDUIT CSV media type metadata"
```

Expected: commit succeeds with only the parser and polling test changes.

## Task 3: Add Cached Preview And Download Regression Coverage

**Files:**
- Modify: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Update the cached CSV preview test to include header metadata and E notation**

In the test named `users can view table previews for existing cached csv results`, change the result `media_type`, stored CSV body, and expected preview.

Use this result media type:

```php
'media_type' => 'text/csv; header=present',
```

Use this stored file body:

```php
Storage::disk('local')->put($path, "length,gas\n0,1.23E-04\n");
```

Use this expected preview:

```php
expect($response->inertiaProps('execution.results.0.preview'))->toMatchArray([
    'kind' => 'csv',
    'data' => [
        'headers' => ['length', 'gas'],
        'rows' => [['0', '1.23E-04']],
        'truncated' => false,
        'source' => "length,gas\n0,1.23E-04\n",
    ],
]);
```

- [ ] **Step 2: Update on-demand remote CSV download coverage for media type metadata**

In the test named `users can download and cache remote result files on demand`, change the fake remote response body and header to:

```php
'https://voice.pi.ingv.it/geoinquire/jobs/job-1/results/outfile' => Http::response("length,gas\n0,1.23E-04\n", 200, [
    'Content-Type' => 'text/csv; header=present',
]),
```

After the existing storage assertion, add:

```php
expect($result->refresh()->cache_status)->toBe(ResultCacheStatus::Cached)
    ->and($result->media_type)->toBe('text/csv; header=present');
```

If the existing standalone expectation for cache status remains, replace it with the chained expectation above so the assertion is not duplicated.

- [ ] **Step 3: Run the focused regression tests**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
docker compose --env-file .env.develop -f compose.yaml -f compose.develop.yaml exec laravel php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php --filter='csv|remote result files'
```

Expected: PASS.

- [ ] **Step 4: Commit the regression tests**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
git add proxy/tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "Cover cached CONDUIT CSV result metadata"
```

Expected: commit succeeds with only `ProcessExecutionResultTest.php` staged.

## Task 4: Run Formatting And Affected Test Suite

**Files:**
- Verify: `app/Services/Ogc/OgcResultResponseParser.php`
- Verify: `tests/Feature/Ogc/PollProcessExecutionJobTest.php`
- Verify: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Format PHP with Pint inside Docker**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
docker compose --env-file .env.develop -f compose.yaml -f compose.develop.yaml exec laravel vendor/bin/pint --dirty --format agent
```

Expected: Pint completes successfully. If Pint changes files, inspect and include them in the final commit.

- [ ] **Step 2: Run the affected feature tests inside Docker**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
docker compose --env-file .env.develop -f compose.yaml -f compose.develop.yaml exec laravel php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: PASS.

- [ ] **Step 3: Inspect the final diff**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy/proxy`:

```bash
git status --short
git diff --stat
git diff -- app/Services/Ogc/OgcResultResponseParser.php tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: only planned files are changed.

- [ ] **Step 4: Commit formatting changes if any remain**

If Pint changed files after the Task 2 or Task 3 commits, run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
git add proxy/app/Services/Ogc/OgcResultResponseParser.php proxy/tests/Feature/Ogc/PollProcessExecutionJobTest.php proxy/tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "Format CONDUIT CSV integration changes"
```

Expected: commit succeeds only if formatting produced additional changes. Skip this step when `git status --short` is clean.

## Task 5: Final Verification

**Files:**
- Verify git state and test evidence.

- [ ] **Step 1: Run final status check**

Run from `/Users/nicola/Desktop/repository/pygeoapi-proxy`:

```bash
git status --short
```

Expected: no uncommitted implementation changes except this plan file if it was intentionally left uncommitted.

- [ ] **Step 2: Summarize verification evidence**

Record these exact results in the final response:

```text
Focused polling test: PASS
Process execution result regression tests: PASS
Affected feature tests: PASS
Pint: PASS
```

Expected: the final response names any command that could not be run and why.
