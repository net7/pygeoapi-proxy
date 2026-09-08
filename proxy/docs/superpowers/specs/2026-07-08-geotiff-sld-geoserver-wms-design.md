# GeoTIFF + SLD GeoServer WMS Design

## Objective

Render paired process outputs such as `dem.geotiff` and `dem.sld` as a GIS-style map layer instead of decoding the GeoTIFF in the browser.

The target pipeline is:

```text
GeoTIFF + SLD -> GeoServer coverage/style -> WMS GetMap tiles -> Laravel policy-protected tile proxy -> MapLibre raster layer
```

The existing client-side canvas preview is not a fallback for the new flow. If the WMS layer is not published yet, the UI shows the map output card with a clear layer status and the existing GeoTIFF/SLD download actions.

## Current State

The application currently:

- stores process result files under `storage/app/private/ogc-results/{execution_id}/...`;
- keeps `*.geotiff` and `*.sld` as separate `process_execution_results` records;
- groups paired results in the frontend with `groupProcessResults`;
- renders grouped GeoTIFF/SLD outputs through `GeoTiffMapResultPreview`;
- fetches protected files through `jobs.results.preview-file`;
- decodes GeoTIFF and SLD in the browser with `geotiff` and `geostyler-sld-parser`;
- overlays a generated canvas in MapLibre.

That client-side renderer is useful as a prototype, but it cannot match a GIS server for SLD raster styling, CRS handling, tiling, caching, or consistent portal-like rendering.

## External Services

Add a GeoServer service to the compose stack.

GeoServer needs:

- a persistent GeoServer data volume;
- internal network access from Laravel;
- no public port required by default;
- credentials supplied through environment variables;
- a workspace dedicated to this app, for example `pygeoapi_proxy`.

The base compose file should define the service and volume for `develop` and `staging` only. Environment-specific compose files can decide whether to expose GeoServer for local debugging. Staging should keep GeoServer internal unless there is a deliberate public gateway.

Relevant configuration keys:

- `GEOSERVER_INTERNAL_URL`, for Laravel-to-GeoServer REST and WMS calls;
- `GEOSERVER_PUBLIC_URL`, optional and not used for private job layers by default;
- `GEOSERVER_USERNAME`;
- `GEOSERVER_PASSWORD`;
- `GEOSERVER_WORKSPACE`, default `pygeoapi_proxy`;
- `GEOSERVER_WMS_VERSION`, default `1.1.1`.

## Publication Model

Add map publication metadata to the GeoTIFF result record. The metadata belongs to the `*.geotiff` result because that result is the coverage source, while the sibling `*.sld` result supplies the style.

Add nullable columns to `process_execution_results`:

- `map_layer_status`: `pending`, `publishing`, `published`, `failed`;
- `map_layer_type`: initially `wms`;
- `map_layer_name`: GeoServer layer name;
- `map_style_name`: GeoServer style name;
- `map_layer_bounds`: JSON bounds metadata returned or derived during publication;
- `map_layer_error`: latest publish failure message;
- `map_layer_published_at`: timestamp.

Only GeoTIFF component results use these columns. Non-map outputs leave them null.

## Publishing Flow

When result storage creates or updates process execution results, it should detect complete map pairs:

- `{output}.geotiff`;
- `{output}.sld`;
- both cached locally;
- GeoTIFF media type is `image/tiff` or `application/tiff`;
- SLD media type is `application/vnd.ogc.sld+xml`.

For each complete pair, dispatch an idempotent queue job such as `PublishGeoTiffMapLayer`.

The job:

1. Locks the GeoTIFF result to prevent duplicate publication.
2. Sets `map_layer_status = publishing`.
3. Ensures the GeoServer workspace exists.
4. Creates deterministic names from app, environment, execution id, and output id.
5. Uploads the GeoTIFF as a GeoServer coverage store.
6. Uploads the SLD as a GeoServer style.
7. Assigns the style to the coverage layer.
8. Marks the GeoTIFF result as `published`.
9. Stores layer/style names and bounds metadata.

If publication fails, the job marks the GeoTIFF result as `failed` and stores a sanitized error. Retries should be handled by the queue. A later retry must be able to overwrite the same GeoServer resources.

The publication should be server-side. The browser must not download the GeoTIFF or SLD to render the map.

## GeoServer API Use

Use GeoServer REST APIs from Laravel.

The design relies on these documented GeoServer REST capabilities:

- uploading a coverage store file through `/workspaces/<ws>/coveragestores/<cs>/file.<extension>`;
- uploading SLD styles through the style REST endpoints with `application/vnd.ogc.sld+xml`;
- serving the resulting layer through WMS `GetMap`.

Context7 references used during design:

- `/websites/geoserver_stable_en_user`, query `REST API publish GeoTIFF coverage store upload SLD style WMS layer`;
- `/maplibre/maplibre-gl-js`, query `raster tile source WMS layer addSource addLayer tiles bbox`.

## Protected Tile Proxy

Do not expose private job layers by giving the frontend a direct GeoServer WMS URL.

Add a Laravel route, protected by the same `ProcessExecutionPolicy::view` logic used by downloads:

```text
GET /jobs/{processExecution}/results/{result}/map-tile
```

Expected query parameters:

- `bbox`, using MapLibre `{bbox-epsg-3857}`;
- `width`, default `256`;
- `height`, default `256`;

The controller verifies:

- authenticated user can view the execution;
- result belongs to the execution;
- result is a published GeoTIFF map layer;
- requested dimensions are within a small safe limit;
- bbox parses to four finite numbers.

The controller then proxies a WMS `GetMap` request to `GEOSERVER_INTERNAL_URL` and returns the PNG response. GeoServer remains internal, and Laravel remains the policy boundary.

The MapLibre source uses the Laravel route as its tile template:

```text
/jobs/{execution}/results/{geotiff}/map-tile?bbox={bbox-epsg-3857}&width=256&height=256
```

## Frontend Rendering

Keep the grouped output card, but change its rendering strategy:

- if `geotiff.mapLayer.status === published`, render a MapLibre raster source using the protected Laravel tile URL;
- if status is `pending` or `publishing`, show a compact “layer in preparation” state;
- if status is `failed`, show a compact “layer unavailable” state;
- always keep separate GeoTIFF and SLD download buttons.

Remove the client-side GeoTIFF/SLD decoding path from the card. The component should not import `geotiff`, `geostyler-sld-parser`, or `buildGeoTiffMapPreview`.

The existing grouping helper can stay, but its visual item should expose the GeoTIFF result map metadata so the card can decide whether the WMS layer is available.

## Dependency Cleanup

After the WMS renderer is in place, remove browser-only preview dependencies if no other code uses them:

- `geotiff`;
- `geostyler-sld-parser`;
- `resources/js/lib/geotiff-map-preview.ts`;
- `resources/js/types/geostyler-sld-parser.d.ts`;
- frontend tests dedicated only to client-side GeoTIFF decoding.

Keep `maplibre-gl`.

The old `preview-file` route and `previewFile()` controller action are no longer part of map rendering. Remove them unless another feature still needs protected inline file previews.

## Error Handling

Publication failures must not block job completion or result downloads.

The UI states are:

- `pending`: pair exists but publication has not started;
- `publishing`: publication job is running or retrying;
- `published`: WMS tiles are available;
- `failed`: publication failed; downloads still work.

The failed state should not expose internal GeoServer URLs, credentials, stack traces, or raw exception messages. Store sanitized messages in `map_layer_error`.

If a tile proxy request fails after a layer is marked published, return a short-lived `502` and log the GeoServer response details server-side.

## Security

GeoServer credentials stay server-side.

GeoServer should not be exposed publicly for private process result layers. The browser requests tiles through Laravel, and Laravel authorizes each request through the existing process execution policy.

The tile endpoint must validate dimensions and bbox to avoid turning it into an unbounded proxy.

Layer names, style names, and file names sent to GeoServer must be deterministic and sanitized. Do not use raw user-supplied strings directly.

## Operational Notes

Add an Artisan command for recovery and backfill:

```text
php artisan ogc:publish-map-layers {execution?} {--failed} {--all}
```

This command republishes cached GeoTIFF/SLD pairs and is useful when GeoServer is introduced into an environment that already has stored jobs.

The queue worker/Horizon must be running for automatic publication. If it is not running, map outputs remain in `pending` and downloads continue to work.

## Testing

Backend tests:

- detection of complete `*.geotiff` + `*.sld` pairs dispatches publication;
- incomplete pairs do not dispatch;
- publication job calls GeoServer REST endpoints with expected workspace, coverage, and style names;
- failures store `map_layer_status = failed` and sanitized errors;
- tile endpoint enforces `ProcessExecutionPolicy::view`;
- tile endpoint rejects results from other executions;
- tile endpoint rejects unpublished results;
- tile endpoint validates bbox and dimensions;
- tile endpoint proxies WMS PNG responses.

Frontend tests:

- grouped map output renders a WMS MapLibre source when published;
- pending/publishing state does not use client-side canvas preview;
- failed state keeps download actions visible;
- old client-side preview imports are absent.

Build checks:

- TypeScript passes after removing browser decoder dependencies;
- Vite build passes;
- PHP tests for OGC result downloads still pass.

## Out Of Scope

This design does not implement true 3D terrain.

If the product later needs 3D terrain, the DEM must be converted into terrain tiles and rendered through MapLibre `raster-dem` or CesiumJS. That is a separate feature from GIS-style WMS rendering.
