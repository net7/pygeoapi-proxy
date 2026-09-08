# GeoTIFF SLD GeoServer WMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render paired GeoTIFF and SLD process outputs as a single MapLibre map layer backed by GeoServer WMS tiles, keep both file downloads available, protect every map endpoint with existing process execution policies, and remove the current client-side GeoTIFF canvas preview fallback completely.

**Architecture:** Laravel stores process outputs as today, detects complete GeoTIFF plus SLD result pairs, publishes them asynchronously to an internal GeoServer coverage store/style, records publication metadata on `process_execution_results`, exposes a policy-protected tile proxy endpoint, and renders the published WMS layer in MapLibre from the process detail page. Non-published layers show only status plus downloads, with no old canvas/image fallback.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia v3, React 19, Wayfinder, MapLibre GL JS, GeoServer REST API, Docker Compose.

---

## Implementation Notes

- Work in the current workspace only. The user explicitly requested no git worktrees.
- Parent Compose files are `../compose.yaml`, `../compose.develop.yaml`, and `../compose.staging.yaml`. These deployment files and the guides in `../DEPLOY.md` and `../DEPLOY.it.md` apply exclusively to `develop` and `staging`.
- Do not keep the old client-side GeoTIFF preview as fallback. Once the WMS flow exists, unpublished/failed layers show state text and download buttons only.
- Keep MapLibre. Remove `geotiff` and `geostyler-sld-parser` frontend runtime dependencies because raster decoding and SLD interpretation move server-side to GeoServer.
- The tile endpoint must authorize with `ProcessExecutionPolicy::view` through the existing process execution authorization flow before proxying any WMS request.
- Use deterministic, sanitized GeoServer workspace/store/layer/style names so publication is idempotent.

## Current Files To Touch

- `../compose.yaml`
- `../compose.develop.yaml`
- `../compose.staging.yaml`
- `.env.example`
- `config/geoserver.php`
- `database/migrations/*_add_map_layer_metadata_to_process_execution_results_table.php`
- `app/Enums/Ogc/MapLayerStatus.php`
- `app/Models/ProcessExecutionResult.php`
- `app/Actions/Ogc/StoreProcessResult.php`
- `app/Jobs/Ogc/PublishGeoTiffMapLayerJob.php`
- `app/Services/Ogc/GeoServerClient.php`
- `app/Support/Ogc/GeoServerName.php`
- `app/Console/Commands/PublishOgcMapLayersCommand.php`
- `app/Http/Controllers/Ogc/ProcessExecutionController.php`
- `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`
- `app/Http/Controllers/Ogc/ProcessExecutionResultMapTileController.php`
- `routes/web.php`
- `resources/js/pages/process-executions/show.tsx`
- `resources/js/components/ogc/geotiff-map-result-preview.tsx`
- `resources/js/lib/ogc-result-groups.ts`
- `resources/js/types/index.ts`
- `package.json`
- `bun.lock`
- `tests/Feature/Ogc/ProcessExecutionResultTest.php`
- `tests/Feature/Ogc/PollProcessExecutionJobTest.php`
- `tests/Feature/Ogc/PublishGeoTiffMapLayerJobTest.php`
- `tests/Feature/Ogc/PublishOgcMapLayersCommandTest.php`
- `tests/Frontend/ogc-outputs.test.ts`
- `tests/Unit/ProcessUiLayoutTest.php`

## Files To Delete

- `resources/js/lib/geotiff-map-preview.ts`
- `resources/js/types/geostyler-sld-parser.d.ts`
- `tests/Frontend/geotiff-map-preview.test.ts`

## Task 1: Add GeoServer Configuration And Service Definition

- [ ] Add a Laravel config file.

Create `config/geoserver.php`:

```php
<?php

declare(strict_types=1);

return [
    'enabled' => env('GEOSERVER_ENABLED', true),
    'internal_url' => rtrim((string) env('GEOSERVER_INTERNAL_URL', 'http://geoserver:8080/geoserver'), '/'),
    'public_url' => rtrim((string) env('GEOSERVER_PUBLIC_URL', 'http://localhost:8081/geoserver'), '/'),
    'username' => env('GEOSERVER_USERNAME', 'admin'),
    'password' => env('GEOSERVER_PASSWORD', 'geoserver'),
    'workspace' => env('GEOSERVER_WORKSPACE', 'pygeoapi_proxy'),
    'tile_timeout' => (int) env('GEOSERVER_TILE_TIMEOUT', 30),
    'rest_timeout' => (int) env('GEOSERVER_REST_TIMEOUT', 30),
];
```

- [ ] Add environment examples to `.env.example`.

Add:

```dotenv
GEOSERVER_ENABLED=true
GEOSERVER_INTERNAL_URL=http://geoserver:8080/geoserver
GEOSERVER_PUBLIC_URL=http://localhost:8081/geoserver
GEOSERVER_USERNAME=admin
GEOSERVER_PASSWORD=geoserver
GEOSERVER_WORKSPACE=pygeoapi_proxy
GEOSERVER_TILE_TIMEOUT=30
GEOSERVER_REST_TIMEOUT=30
```

- [ ] Add a `geoserver` service to `../compose.yaml`.

Use the official image and a persistent data volume:

```yaml
  geoserver:
    image: docker.osgeo.org/geoserver:2.27.1
    environment:
      GEOSERVER_ADMIN_USER: ${GEOSERVER_USERNAME:-admin}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_PASSWORD:-geoserver}
    volumes:
      - geoserver-data:/opt/geoserver_data
      - laravel-storage:/var/www/html/storage:ro
    networks:
      - pygeoapi-proxy-network

volumes:
  geoserver-data:
```

Use `docker.osgeo.org/geoserver:2.27.1`. Keep the service on the existing project network.

- [ ] Add development port mapping to `../compose.develop.yaml`.

```yaml
  geoserver:
    ports:
      - '${GEOSERVER_PORT:-8081}:8080'
```

- [ ] Add staging service participation to `../compose.staging.yaml`.

The service should not publish a public port in staging. Laravel reaches it on the compose network through `GEOSERVER_INTERNAL_URL`.

- [ ] Verification.

Run:

```bash
docker compose -f ../compose.yaml -f ../compose.develop.yaml config
```

Expected outcome:

- command exits `0`
- rendered config contains a `geoserver` service
- rendered config contains a `geoserver-data` volume
- `laravel`, `horizon`, and `geoserver` share `pygeoapi-proxy-network`

## Task 2: Add Map Layer Metadata To Results

- [ ] Generate the migration.

Run:

```bash
php artisan make:migration add_map_layer_metadata_to_process_execution_results_table --table=process_execution_results --no-interaction
```

- [ ] Implement the migration.

Add nullable metadata to `process_execution_results`:

```php
Schema::table('process_execution_results', function (Blueprint $table): void {
    $table->string('map_layer_status')->nullable()->after('preview');
    $table->string('map_layer_type')->nullable()->after('map_layer_status');
    $table->string('map_layer_name')->nullable()->after('map_layer_type');
    $table->string('map_style_name')->nullable()->after('map_layer_name');
    $table->json('map_layer_bounds')->nullable()->after('map_style_name');
    $table->text('map_layer_error')->nullable()->after('map_layer_bounds');
    $table->timestamp('map_layer_published_at')->nullable()->after('map_layer_error');

    $table->index(['process_execution_id', 'map_layer_status'], 'process_results_execution_map_status_index');
});
```

The `down()` method must drop the index first and then drop the columns.

- [ ] Add enum `app/Enums/Ogc/MapLayerStatus.php`.

```php
<?php

declare(strict_types=1);

namespace App\Enums\Ogc;

enum MapLayerStatus: string
{
    case Pending = 'pending';
    case Publishing = 'publishing';
    case Published = 'published';
    case Failed = 'failed';
}
```

- [ ] Update `app/Models/ProcessExecutionResult.php`.

Add to `$fillable`:

```php
'map_layer_status',
'map_layer_type',
'map_layer_name',
'map_style_name',
'map_layer_bounds',
'map_layer_error',
'map_layer_published_at',
```

Add to `$casts`:

```php
'map_layer_status' => MapLayerStatus::class,
'map_layer_bounds' => 'array',
'map_layer_published_at' => 'datetime',
```

Import `App\Enums\Ogc\MapLayerStatus`.

- [ ] Add a focused model/migration assertion in an existing feature test or a new unit test only if current migration tests exist. Do not create a broad migration smoke test if the project does not use them.

- [ ] Verification.

Run:

```bash
php artisan test --compact --filter=ProcessExecutionResult
```

Expected outcome:

- command exits `0`
- existing process result tests still pass before endpoint changes

## Task 3: Add GeoServer Name Helper

- [ ] Create `app/Support/Ogc/GeoServerName.php`.

The helper must generate stable GeoServer identifiers from execution/result ids and output names.

```php
<?php

declare(strict_types=1);

namespace App\Support\Ogc;

use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Support\Str;

final class GeoServerName
{
    public static function layer(ProcessExecution $execution, ProcessExecutionResult $result): string
    {
        return self::identifier("pe_{$execution->getKey()}_result_{$result->getKey()}_{$result->title}");
    }

    public static function style(ProcessExecution $execution, ProcessExecutionResult $result): string
    {
        return self::identifier(self::layer($execution, $result).'_style');
    }

    private static function identifier(string $value): string
    {
        $identifier = Str::of($value)
            ->lower()
            ->replaceMatches('/[^a-z0-9_]+/', '_')
            ->replaceMatches('/_+/', '_')
            ->trim('_')
            ->limit(63, '');

        return $identifier->isEmpty() ? 'layer' : $identifier->toString();
    }
}
```

- [ ] Add a unit test if there is a nearby support/helper test pattern. Assert names are lowercase, deterministic, <= 63 characters, and contain only `[a-z0-9_]`.

Verification:

```bash
php artisan test --compact --filter=GeoServerName
```

Expected outcome:

- command exits `0` if a test was added
- otherwise no command is required for this helper until it is covered through job tests

## Task 4: Add GeoServer Client

- [ ] Create `app/Services/Ogc/GeoServerClient.php`.

Public methods:

```php
public function ensureWorkspace(): void;

public function publishGeoTiff(
    string $storeName,
    string $coverageName,
    string $absoluteGeoTiffPath,
): void;

public function uploadStyle(
    string $styleName,
    string $absoluteSldPath,
): void;

public function assignDefaultStyle(
    string $layerName,
    string $styleName,
): void;

/**
 * @param array{bbox: string, width: int, height: int} $tile
 */
public function getPngTile(string $layerName, array $tile): \Illuminate\Http\Client\Response;
```

Implementation rules:

- Use `Http::withBasicAuth($username, $password)`.
- Use `timeout(config('geoserver.rest_timeout'))` for REST calls.
- Use `timeout(config('geoserver.tile_timeout'))` for WMS calls.
- Treat `200`, `201`, and `202` as success for REST writes.
- Treat `404` on "GET workspace/style" as "create it".
- Throw `Illuminate\Http\Client\RequestException` or `RuntimeException` with sanitized messages. Never include the GeoServer password in exception text.
- `ensureWorkspace()`:
  - `GET /rest/workspaces/{workspace}.json`
  - if 404, `POST /rest/workspaces` with XML:
    ```xml
    <workspace><name>pygeoapi_proxy</name></workspace>
    ```
- `publishGeoTiff()`:
  - `PUT /rest/workspaces/{workspace}/coveragestores/{storeName}/file.geotiff`
  - query params:
    - `configure=all`
    - `coverageName={coverageName}`
  - body: file contents from `$absoluteGeoTiffPath`
  - content type: `image/tiff`
- `uploadStyle()`:
  - `GET /rest/workspaces/{workspace}/styles/{styleName}.json`
  - if missing, create metadata with:
    `POST /rest/workspaces/{workspace}/styles`
    XML:
    ```xml
    <style><name>{styleName}</name><filename>{styleName}.sld</filename></style>
    ```
  - `PUT /rest/workspaces/{workspace}/styles/{styleName}`
  - body: file contents from `$absoluteSldPath`
  - content type: `application/vnd.ogc.sld+xml`
- `assignDefaultStyle()`:
  - `PUT /rest/layers/{workspace}:{layerName}`
  - XML body:
    ```xml
    <layer><defaultStyle><name>{styleName}</name><workspace>{workspace}</workspace></defaultStyle></layer>
    ```
- `getPngTile()`:
  - `GET /wms`
  - params:
    - `service=WMS`
    - `version=1.1.1`
    - `request=GetMap`
    - `layers={workspace}:{layerName}`
    - `styles={styleName can be omitted because default style is assigned}`
    - `format=image/png`
    - `transparent=true`
    - `srs=EPSG:3857`
    - `bbox={bbox}`
    - `width={width}`
    - `height={height}`

- [ ] Add tests with `Http::fake()` in `tests/Feature/Ogc/PublishGeoTiffMapLayerJobTest.php` or a dedicated client unit test.

Assertions:

- workspace is created when missing
- GeoTIFF upload sends `image/tiff`
- SLD upload sends `application/vnd.ogc.sld+xml`
- layer style assignment hits `/rest/layers/{workspace}:{layer}`
- tile request includes `service=WMS`, `request=GetMap`, `srs=EPSG:3857`

Verification:

```bash
php artisan test --compact --filter=GeoServerClient
```

Expected outcome:

- command exits `0`
- fake HTTP assertions pass

## Task 5: Publish Complete GeoTIFF And SLD Pairs

- [ ] Create `app/Jobs/Ogc/PublishGeoTiffMapLayerJob.php`.

Constructor:

```php
public function __construct(
    public int $processExecutionId,
    public int $geoTiffResultId,
    public int $sldResultId,
) {}
```

Behavior:

1. Return immediately when `config('geoserver.enabled')` is false.
2. Load the execution with both results.
3. Verify both results belong to the execution.
4. Verify both result files are cached and exist on the configured storage disk.
5. Set the GeoTIFF result to:
   - `map_layer_status = publishing`
   - `map_layer_type = wms`
   - `map_layer_error = null`
6. Generate names with `GeoServerName`.
7. Call:
   - `GeoServerClient::ensureWorkspace()`
   - `GeoServerClient::publishGeoTiff($layerName, $layerName, $geoTiffPath)`
   - `GeoServerClient::uploadStyle($styleName, $sldPath)`
   - `GeoServerClient::assignDefaultStyle($layerName, $styleName)`
8. On success update the GeoTIFF result:
   - `map_layer_status = published`
   - `map_layer_type = wms`
   - `map_layer_name = $layerName`
   - `map_style_name = $styleName`
   - `map_layer_published_at = now()`
   - `map_layer_error = null`
9. On failure update the GeoTIFF result:
   - `map_layer_status = failed`
   - `map_layer_error = Str::limit($exception->getMessage(), 2000)`
   - keep `map_layer_name` and `map_style_name` if they were generated
10. Re-throw the exception so the queue retry/failure lifecycle still works.

- [ ] Dispatch publication from `app/Actions/Ogc/StoreProcessResult.php`.

After the result upsert finishes for an execution response, detect result pairs by normalized output key:

- A GeoTIFF candidate has media type `image/tiff`, extension `.tif` or `.tiff`, or title ending with `GeoTIFF`.
- An SLD candidate has media type `application/vnd.ogc.sld+xml`, extension `.sld`, or title containing `Styled Layer Descriptor`.
- Pair titles by removing descriptor phrases:
  - ` - Reference to the GeoTIFF.`
  - ` - Reference to the Styled Layer Descriptor (SLD) defining the visualization style for this GeoTIFF.`
  - trailing `GeoTIFF`
  - trailing `SLD`
- When both files are cached, dispatch `PublishGeoTiffMapLayerJob`.
- Dispatch only when the GeoTIFF result is not already `publishing` or `published`.
- Before dispatch, update the GeoTIFF result to:
  - `map_layer_status = pending`
  - `map_layer_type = wms`

- [ ] Add a feature test in `tests/Feature/Ogc/PollProcessExecutionJobTest.php`.

Test name:

```php
it('queues map layer publication when cached geotiff and sld outputs are stored')
```

Arrange:

- `Bus::fake([PublishGeoTiffMapLayerJob::class])`
- existing process execution fixture with one GeoTIFF and one matching SLD response value
- fake storage contains both downloaded files or use existing poll fixtures that cache them

Assert:

- GeoTIFF result has `map_layer_status = pending`
- `PublishGeoTiffMapLayerJob` dispatched with execution id, GeoTIFF result id, and SLD result id

- [ ] Add job tests in `tests/Feature/Ogc/PublishGeoTiffMapLayerJobTest.php`.

Tests:

```php
it('publishes cached geotiff and sld outputs to geoserver')
it('marks the map layer as failed when geoserver publication fails')
it('does not publish when geoserver publication is disabled')
```

Use `Http::fake()` and `Storage::fake()` to avoid real GeoServer.

Verification:

```bash
php artisan test --compact tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/PublishGeoTiffMapLayerJobTest.php
```

Expected outcome:

- command exits `0`
- publication dispatch and job state transitions are covered

## Task 6: Add Manual Backfill Command

- [ ] Create `app/Console/Commands/PublishOgcMapLayersCommand.php`.

Signature:

```php
protected $signature = 'ogc:publish-map-layers
    {execution? : Optional process execution id}
    {--failed : Requeue failed publications}
    {--all : Requeue pending and unpublished publications for all executions}';
```

Behavior:

- With `{execution}`, scan only that execution.
- With `--all`, scan all executions with cached GeoTIFF/SLD pairs.
- With `--failed`, include failed GeoTIFF results.
- Without `{execution}` and without `--all`, print an error and return `Command::FAILURE`.
- Use the same pairing logic as `StoreProcessResult`.
- Dispatch `PublishGeoTiffMapLayerJob` for eligible pairs.
- Print the count of dispatched jobs.

- [ ] Extract pairing logic to `app/Actions/Ogc/FindGeoTiffSldResultPairs.php`.

Return shape:

```php
/**
 * @return \Illuminate\Support\Collection<int, array{geotiff: ProcessExecutionResult, sld: ProcessExecutionResult}>
 */
public function handle(ProcessExecution $execution): Collection;
```

Use this action from both `StoreProcessResult` and `PublishOgcMapLayersCommand`.

- [ ] Add `tests/Feature/Ogc/PublishOgcMapLayersCommandTest.php`.

Tests:

```php
it('requires an execution id unless all is requested')
it('dispatches publication jobs for a single execution')
it('can requeue failed publications when requested')
```

Verification:

```bash
php artisan test --compact tests/Feature/Ogc/PublishOgcMapLayersCommandTest.php
```

Expected outcome:

- command exits `0`
- no command talks to real GeoServer

## Task 7: Add Policy-Protected WMS Tile Proxy

- [ ] Add controller `app/Http/Controllers/Ogc/ProcessExecutionResultMapTileController.php`.

Method:

```php
public function __invoke(
    Request $request,
    ProcessExecution $processExecution,
    ProcessExecutionResult $result,
    GeoServerClient $geoServer,
): Response
```

Behavior:

1. `$this->authorize('view', $processExecution);`
2. Abort `404` if `$result->process_execution_id !== $processExecution->getKey()`.
3. Abort `404` unless:
   - `$result->map_layer_type === 'wms'`
   - `$result->map_layer_status === MapLayerStatus::Published`
   - `$result->map_layer_name` is not blank
4. Validate query:
   - `bbox`: required string containing exactly four finite comma-separated numbers
   - `width`: nullable integer min 1 max 1024, default 256
   - `height`: nullable integer min 1 max 1024, default 256
5. Call `GeoServerClient::getPngTile($result->map_layer_name, $tile)`.
6. If GeoServer returns non-success, abort with `502`.
7. Return the tile bytes with headers:
   - `Content-Type: image/png`
   - `Cache-Control: private, max-age=60`

- [ ] Add route to `routes/web.php` inside the existing authenticated process execution group:

```php
Route::get('jobs/{processExecution}/results/{result}/map-tile', ProcessExecutionResultMapTileController::class)
    ->name('jobs.results.map-tile');
```

- [ ] Remove the old preview route:

```php
Route::get('jobs/{processExecution}/results/{result}/preview-file', [ProcessExecutionResultController::class, 'previewFile'])
    ->name('jobs.results.preview-file');
```

- [ ] Remove `previewFile()` and `isMapPreviewResult()` from `app/Http/Controllers/Ogc/ProcessExecutionResultController.php`.

Keep `download()` unchanged.

- [ ] Add tests to `tests/Feature/Ogc/ProcessExecutionResultTest.php`.

Tests:

```php
it('proxies published map tiles for authorized users')
it('rejects map tile requests for results outside the execution')
it('rejects map tile requests when the layer is not published')
it('validates map tile bbox dimensions')
it('does not expose the old preview file endpoint')
```

Use `Http::fake()` for GeoServer WMS. The successful test must assert:

- response status `200`
- content type contains `image/png`
- GeoServer request includes `bbox`, `width`, `height`, `layers={workspace}:{map_layer_name}`

Verification:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected outcome:

- command exits `0`
- old preview endpoint assertion returns `404`
- tile proxy authorization and validation pass

## Task 8: Expose Map Layer Metadata To Inertia

- [ ] Update result serialization in `app/Http/Controllers/Ogc/ProcessExecutionController.php`.

Each result returned to the process detail page must include:

```php
'mapLayer' => [
    'type' => $result->map_layer_type,
    'status' => $result->map_layer_status?->value,
    'name' => $result->map_layer_name,
    'styleName' => $result->map_style_name,
    'bounds' => $result->map_layer_bounds,
    'publishedAt' => $result->map_layer_published_at?->toISOString(),
    'error' => $result->map_layer_error,
],
```

Only include `error` when the current user can view the execution. The page is already authorized, so this is acceptable.

- [ ] Update `resources/js/types/index.ts`.

Add:

```ts
export type ProcessExecutionResultMapLayer = {
    type: 'wms' | null;
    status: 'pending' | 'publishing' | 'published' | 'failed' | null;
    name: string | null;
    styleName: string | null;
    bounds: [number, number, number, number] | null;
    publishedAt: string | null;
    error: string | null;
};
```

Add to `ProcessExecutionResult`:

```ts
mapLayer: ProcessExecutionResultMapLayer;
```

- [ ] Regenerate Wayfinder routes after adding/removing routes.

Run:

```bash
php artisan wayfinder:generate --with-form --no-interaction
```

Expected outcome:

- generated route helpers include `jobs.results.map-tile`
- generated route helpers no longer include `jobs.results.preview-file`

Verification:

```bash
bunx tsc --noEmit
```

Expected outcome:

- command exits `0` after frontend changes are complete

## Task 9: Replace Frontend Preview With WMS Map Layer

- [ ] Update `resources/js/lib/ogc-result-groups.ts`.

Keep grouping GeoTIFF and SLD outputs into one visual item. Ensure the returned item exposes:

```ts
{
    type: 'geotiff-map',
    key: string,
    title: string,
    description: string | null,
    geotiff: ProcessExecutionResult,
    sld: ProcessExecutionResult | null,
}
```

Do not require `sld` for downloads to render; show only GeoTIFF download when SLD is missing.

- [ ] Replace `resources/js/components/ogc/geotiff-map-result-preview.tsx`.

Requirements:

- Import MapLibre CSS and JS as today.
- Import route helper for `jobs.results.map-tile`.
- Do not import `geotiff`, `geostyler-sld-parser`, or `buildGeoTiffMapPreview`.
- Do not fetch the GeoTIFF or SLD in the browser.
- Render a MapLibre map only when `geotiff.mapLayer.status === 'published'` and `geotiff.mapLayer.type === 'wms'`.
- Add a raster source:

```ts
map.addSource('geotiff-wms', {
    type: 'raster',
    tiles: [
        `${tileUrl}&bbox={bbox-epsg-3857}&width=256&height=256`,
    ],
    tileSize: 256,
});
```

- Add a raster layer:

```ts
map.addLayer({
    id: 'geotiff-wms-layer',
    type: 'raster',
    source: 'geotiff-wms',
    paint: {
        'raster-opacity': 0.82,
        'raster-resampling': 'linear',
    },
});
```

- Keep the existing OSM raster basemap source/layer.
- Set initial map center to the result bounds when `mapLayer.bounds` is present. Otherwise use `[0, 20]` with zoom `1.5` so the user sees the world map.
- Fit bounds after the WMS layer is added when bounds are present.
- Render download buttons for GeoTIFF and SLD at all statuses.
- For `pending` and `publishing`, show a compact status line such as `Mappa in preparazione`.
- For `failed`, show `Mappa non disponibile` and the sanitized error text when present.
- For missing metadata, show `Mappa non ancora pubblicata`.
- No canvas, no generated hillshade, no old preview fallback.

- [ ] Update `resources/js/pages/process-executions/show.tsx` only as needed for changed props/route helpers.

- [ ] Update frontend tests.

In `tests/Frontend/ogc-outputs.test.ts` assert:

- GeoTIFF and SLD still group into one visual item.
- Both file ids remain accessible for downloads.
- Grouping does not depend on old preview metadata.

In `tests/Unit/ProcessUiLayoutTest.php` replace the old canvas preview assertion with:

```php
it('renders geotiff outputs through the protected map tile route')
```

Assertions:

- component imports or references `map-tile`
- component does not reference `preview-file`
- component does not reference `buildGeoTiffMapPreview`
- page still uses `groupProcessResults`

Verification:

```bash
bun test tests/Frontend/ogc-outputs.test.ts
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php
```

Expected outcome:

- both commands exit `0`
- no test imports deleted preview code

## Task 10: Remove Old Client-Side Preview Code

- [ ] Delete old files.

Remove:

```text
resources/js/lib/geotiff-map-preview.ts
resources/js/types/geostyler-sld-parser.d.ts
tests/Frontend/geotiff-map-preview.test.ts
```

- [ ] Remove frontend dependencies.

Run:

```bash
bun remove geotiff geostyler-sld-parser
```

Expected outcome:

- `package.json` no longer contains `geotiff`
- `package.json` no longer contains `geostyler-sld-parser`
- `bun.lock` is updated
- `maplibre-gl` remains installed

- [ ] Search for stale references.

Run:

```bash
rg "geotiff-map-preview|buildGeoTiffMapPreview|geostyler-sld-parser|preview-file|previewFile|geotiff-canvas|GeoTIFF preview"
```

Expected outcome:

- no results outside documentation/spec/history files
- no runtime code references the deleted files

## Task 11: Format, Typecheck, Build, And Test

- [ ] Format PHP.

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected outcome:

- command exits `0`
- dirty PHP files are formatted

- [ ] Run focused backend tests.

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionResultTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php tests/Feature/Ogc/PublishGeoTiffMapLayerJobTest.php tests/Feature/Ogc/PublishOgcMapLayersCommandTest.php tests/Unit/ProcessUiLayoutTest.php
```

Expected outcome:

- command exits `0`
- all touched backend behavior passes

- [ ] Run frontend tests.

Run:

```bash
bun test tests/Frontend
```

Expected outcome:

- command exits `0`
- no deleted test is referenced

- [ ] Run TypeScript.

Run:

```bash
bunx tsc --noEmit
```

Expected outcome:

- command exits `0`
- Wayfinder route helper imports are valid

- [ ] Build assets.

Run:

```bash
bun run build
```

Expected outcome:

- command exits `0`
- Vite build completes

- [ ] Optional full backend test pass if focused tests pass and time allows.

Run:

```bash
php artisan test --compact
```

Expected outcome:

- command exits `0`

## Task 12: Manual Runtime Verification

- [ ] Start the stack with GeoServer.

Run:

```bash
make up
```

Expected outcome:

- Laravel, Horizon, Redis, MariaDB, pygeoapi, and GeoServer containers are running

- [ ] Confirm GeoServer is reachable from Laravel.

Run:

```bash
docker compose exec laravel php artisan tinker --execute 'dump(Http::withBasicAuth(config("geoserver.username"), config("geoserver.password"))->get(config("geoserver.internal_url")."/rest/about/version.json")->status());'
```

Expected outcome:

- output contains `200`

- [ ] Backfill a known execution that has cached GeoTIFF and SLD files.

Run:

```bash
php artisan ogc:publish-map-layers {execution_id}
```

Expected outcome:

- command prints `Dispatched 1 map layer publication job.`

- [ ] Let Horizon process the job or run the queue worker for the target queue.

Run one of:

```bash
php artisan queue:work --stop-when-empty
```

Expected outcome:

- job completes without exception
- GeoTIFF result row has `map_layer_status = published`
- `map_layer_name` and `map_style_name` are populated

- [ ] Open the process detail page.

Expected outcome:

- the GeoTIFF and SLD appear as one output card
- both `GeoTIFF` and `SLD` download buttons are visible
- the map shows the world basemap and the published raster layer through MapLibre
- there is no old gray client-side texture/canvas fallback
- browser network panel shows requests to the Laravel `map-tile` route, not direct GeoServer REST/WMS URLs

## Commit Plan

- [ ] Commit 1: GeoServer configuration, migration, model enum, and service client.

Suggested message:

```text
feat: configure geoserver map layer publishing
```

- [ ] Commit 2: publication job, pair detection, command, and backend tests.

Suggested message:

```text
feat: publish geotiff sld outputs to geoserver
```

- [ ] Commit 3: protected WMS tile endpoint and Wayfinder route updates.

Suggested message:

```text
feat: proxy geoserver map tiles for process results
```

- [ ] Commit 4: MapLibre WMS frontend and preview cleanup.

Suggested message:

```text
feat: render process geotiffs from wms tiles
```
