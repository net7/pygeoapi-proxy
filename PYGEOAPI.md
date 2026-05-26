# pygeoapi API reference

Analisi basata su:

- Documentazione stabile: https://docs.pygeoapi.io/en/stable/ (release 0.23.4, 2026-04-27)
- Sorgente upstream: https://github.com/geopython/pygeoapi
- Sorgente locale analizzato: `geopython/pygeoapi` branch `master`, commit `2433cea`, 2026-05-22
- Context7 library ID: `/geopython/pygeoapi`

Nota: pygeoapi genera anche il documento OpenAPI runtime da configurazione. Quindi l'elenco sotto descrive tutte le route implementate nel sorgente, ma le route effettivamente esposte e i formati disponibili dipendono da `server.admin`, `pubsub`, `resources`, `providers`, `formatters`, `manager` e visibilita delle risorse.

## Convenzioni comuni

- Base URL: configurato in `server.url`.
- Formato risposta: `f=<format>` oppure header `Accept`.
- Formati core: `html`, `json`, `jsonld`, `png`, `jpeg`, `mvt`, `NetCDF`; i dataset possono aggiungere formatter custom, ad esempio `csv`.
- Lingua: `lang=<locale>` oppure `Accept-Language`.
- Compressione: se `server.gzip` e `Accept-Encoding` includono `gzip`, la risposta puo essere compressa.
- Errori: pygeoapi restituisce eccezioni OGC/API con status HTTP coerente, ad esempio `InvalidParameterValue`, `NotFound`, `NoApplicableCode`, `NoSuchProcess`, `NoSuchJob`.
- Access control: autenticazione e autorizzazione non sono responsabilita di pygeoapi; Admin API e Transactions vanno protette a monte.

## Mappa completa delle route HTTP

| Metodo | Path | API | Implementazione sorgente | Note |
|---|---|---|---|---|
| GET | `/` | Landing page OGC API | `pygeoapi.api.landing_page` | Link a OpenAPI, conformance, collections, processes, TileMatrixSets, jobs, Pub/Sub. |
| GET | `/openapi` | OpenAPI | `pygeoapi.api.openapi_` | JSON OpenAPI 3.0.2 oppure UI Swagger/ReDoc con `f=html&ui=redoc`. |
| GET | `/asyncapi` | AsyncAPI | `pygeoapi.api.asyncapi_` | Solo se Pub/Sub/AsyncAPI e configurato. |
| GET | `/conformance` | OGC conformance | `pygeoapi.api.conformance` | Aggrega classi di conformita core e provider abilitati. |
| GET | `/TileMatrixSets` | OGC API - Tiles | `pygeoapi.api.tiles.tilematrixsets` | Lista Tile Matrix Set disponibili. |
| GET | `/TileMatrixSets/{tileMatrixSetId}` | OGC API - Tiles | `pygeoapi.api.tiles.tilematrixset` | Dettaglio di un Tile Matrix Set. |
| GET | `/collections` | OGC API - Common | `pygeoapi.api.describe_collections` | Lista delle collection visibili. |
| GET | `/collections/{collectionId}` | OGC API - Common | `pygeoapi.api.describe_collections` | Metadati della collection. |
| GET | `/collections/{collectionId}/schema` | Schema | `pygeoapi.api.get_collection_schema` | JSON Schema per feature, coverage, record o EDR. |
| GET | `/collections/{collectionId}/queryables` | Queryables | `pygeoapi.api.itemtypes.get_collection_queryables` | Queryables per feature, coverage o record. |
| GET | `/collections/{collectionId}/items` | Features/Records | `pygeoapi.api.itemtypes.get_collection_items` | Lista feature o record. |
| POST | `/collections/{collectionId}/items` | Features/Records CQL o transaction create | `pygeoapi.api.itemtypes.get_collection_items` oppure `manage_collection_item` | Con body CQL JSON interroga; con `Content-Type: application/geo+json` crea se provider `editable`. |
| OPTIONS | `/collections/{collectionId}/items` | Transactions | `pygeoapi.api.itemtypes.manage_collection_item` | Restituisce metodi ammessi. |
| GET | `/collections/{collectionId}/items/{itemId}` | Features/Records | `pygeoapi.api.itemtypes.get_collection_item` | Dettaglio feature o record. |
| PUT | `/collections/{collectionId}/items/{itemId}` | Transactions | `pygeoapi.api.itemtypes.manage_collection_item` | Replace/update se provider `editable`. |
| DELETE | `/collections/{collectionId}/items/{itemId}` | Transactions | `pygeoapi.api.itemtypes.manage_collection_item` | Delete se provider `editable`. |
| OPTIONS | `/collections/{collectionId}/items/{itemId}` | Transactions | `pygeoapi.api.itemtypes.manage_collection_item` | Restituisce metodi ammessi. |
| GET | `/collections/{collectionId}/coverage` | OGC API - Coverages | `pygeoapi.api.coverages.get_collection_coverage` | CoverageJSON o formato nativo provider. |
| GET | `/collections/{collectionId}/tiles` | OGC API - Tiles | `pygeoapi.api.tiles.get_collection_tiles` | Tilesets disponibili per collection. |
| GET | `/collections/{collectionId}/tiles/{tileMatrixSetId}` | OGC API - Tiles | `pygeoapi.api.tiles.get_collection_tiles_metadata` | Metadata tileset. |
| GET | `/collections/{collectionId}/tiles/{tileMatrixSetId}/metadata` | OGC API - Tiles | `pygeoapi.api.tiles.get_collection_tiles_metadata` | Alias metadata. |
| GET | `/collections/{collectionId}/tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}` | OGC API - Tiles | `pygeoapi.api.tiles.get_collection_tiles_data` | Tile binaria/raster/vector. |
| GET | `/collections/{collectionId}/map` | OGC API - Maps | `pygeoapi.api.maps.get_collection_map` | Mappa renderizzata. |
| GET | `/collections/{collectionId}/styles/{styleId}/map` | OGC API - Maps | `pygeoapi.api.maps.get_collection_map` | Mappa renderizzata con stile. |
| GET | `/processes` | OGC API - Processes | `pygeoapi.api.processes.describe_processes` | Lista processi. |
| GET | `/processes/{processId}` | OGC API - Processes | `pygeoapi.api.processes.describe_processes` | Descrizione processo. |
| POST | `/processes/{processId}/execution` | OGC API - Processes | `pygeoapi.api.processes.execute_process` | Esecuzione sincrona o asincrona. |
| GET | `/jobs` | OGC API - Processes | `pygeoapi.api.processes.get_jobs` | Lista job. |
| GET | `/jobs/{jobId}` | OGC API - Processes | `pygeoapi.api.processes.get_jobs` | Stato job. |
| DELETE | `/jobs/{jobId}` | OGC API - Processes | `pygeoapi.api.processes.delete_job` | Dismiss/cancel job. |
| GET | `/jobs/{jobId}/results` | OGC API - Processes | `pygeoapi.api.processes.get_job_result` | Risultato job. |
| GET | `/collections/{collectionId}/instances` | OGC API - EDR | `pygeoapi.api.environmental_data_retrieval.get_collection_edr_instances` | Lista istanze EDR. |
| GET | `/collections/{collectionId}/instances/{instanceId}` | OGC API - EDR | `get_collection_edr_instances` | Dettaglio istanza EDR. |
| GET | `/collections/{collectionId}/position` | OGC API - EDR | `get_collection_edr_query` | Query puntuale. |
| GET | `/collections/{collectionId}/area` | OGC API - EDR | `get_collection_edr_query` | Query area. |
| GET | `/collections/{collectionId}/cube` | OGC API - EDR | `get_collection_edr_query` | Query volume/bbox. |
| GET | `/collections/{collectionId}/radius` | OGC API - EDR | `get_collection_edr_query` | Query raggio. |
| GET | `/collections/{collectionId}/trajectory` | OGC API - EDR | `get_collection_edr_query` | Query traiettoria. |
| GET | `/collections/{collectionId}/corridor` | OGC API - EDR | `get_collection_edr_query` | Query corridoio. |
| GET | `/collections/{collectionId}/locations` | OGC API - EDR | `get_collection_edr_query` | Query/lista locations supportata dal provider. |
| GET | `/collections/{collectionId}/locations/{locationId}` | OGC API - EDR | `get_collection_edr_query` | Query location specifica. |
| GET | `/collections/{collectionId}/instances/{instanceId}/position` | OGC API - EDR | `get_collection_edr_query` | Query puntuale su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/area` | OGC API - EDR | `get_collection_edr_query` | Query area su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/cube` | OGC API - EDR | `get_collection_edr_query` | Query cube su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/radius` | OGC API - EDR | `get_collection_edr_query` | Query radius su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/trajectory` | OGC API - EDR | `get_collection_edr_query` | Query trajectory su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/corridor` | OGC API - EDR | `get_collection_edr_query` | Query corridor su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/locations` | OGC API - EDR | `get_collection_edr_query` | Query locations su istanza. |
| GET | `/collections/{collectionId}/instances/{instanceId}/locations/{locationId}` | OGC API - EDR | `get_collection_edr_query` | Query location su istanza. |
| GET | `/stac-api` | STAC API | `pygeoapi.api.stac.landing_page` | Landing page STAC API. |
| GET | `/stac-api/search` | STAC API Item Search | `pygeoapi.api.stac.search` | Ricerca STAC via query string. |
| POST | `/stac-api/search` | STAC API Item Search | `pygeoapi.api.stac.search` | Ricerca STAC via JSON body. |
| GET | `/stac` | Static STAC | `pygeoapi.api.stac.get_stac_root` | Root catalog statico. |
| GET | `/stac/{path}` | Static STAC | `pygeoapi.api.stac.get_stac_path` | Browse catalog, collection, item o file asset. |
| GET | `/admin/config` | Admin API | `pygeoapi.api.admin.get_config_` | Configurazione completa. |
| PUT | `/admin/config` | Admin API | `pygeoapi.api.admin.put_config` | Replace completo configurazione. |
| PATCH | `/admin/config` | Admin API | `pygeoapi.api.admin.patch_config` | Patch merge configurazione. |
| GET | `/admin/config/resources` | Admin API | `pygeoapi.api.admin.get_resources` | Lista risorse configurate. |
| POST | `/admin/config/resources` | Admin API | `pygeoapi.api.admin.post_resource` | Aggiunta risorsa. |
| GET | `/admin/config/resources/{resourceId}` | Admin API | `pygeoapi.api.admin.get_resource` | Dettaglio risorsa. |
| PUT | `/admin/config/resources/{resourceId}` | Admin API | `pygeoapi.api.admin.put_resource` | Replace risorsa. |
| PATCH | `/admin/config/resources/{resourceId}` | Admin API | `pygeoapi.api.admin.patch_resource` | Patch merge risorsa. |
| DELETE | `/admin/config/resources/{resourceId}` | Admin API | `pygeoapi.api.admin.delete_resource` | Rimozione risorsa. |

## Esempi rapidi per endpoint

Gli esempi assumono:

```bash
BASE_URL=http://localhost:5000
COLLECTION=obs
ITEM_ID=371
PROCESS_ID=hello-world
JOB_ID=example-job-id
TMS=WebMercatorQuad
TILE_MATRIX=0
TILE_ROW=0
TILE_COL=0
INSTANCE_ID=latest
LOCATION_ID=station-1
STAC_PATH=my-stac-resource/catalog.json
RESOURCE_ID=obs
```

Sostituire gli identificatori con quelli reali esposti dalla propria configurazione pygeoapi.

### Core, OpenAPI, conformance

```bash
# GET /
curl -s "$BASE_URL/?f=json"

# GET /openapi
curl -s "$BASE_URL/openapi?f=json"

# GET /openapi come Swagger UI
curl -s "$BASE_URL/openapi?f=html"

# GET /openapi come ReDoc
curl -s "$BASE_URL/openapi?f=html&ui=redoc"

# GET /asyncapi
curl -s "$BASE_URL/asyncapi?f=json"

# GET /conformance
curl -s "$BASE_URL/conformance?f=json"
```

### TileMatrixSets

```bash
# GET /TileMatrixSets
curl -s "$BASE_URL/TileMatrixSets?f=json"

# GET /TileMatrixSets/{tileMatrixSetId}
curl -s "$BASE_URL/TileMatrixSets/$TMS?f=json"
```

### Collections, schema, queryables

```bash
# GET /collections
curl -s "$BASE_URL/collections?f=json"

# GET /collections/{collectionId}
curl -s "$BASE_URL/collections/$COLLECTION?f=json"

# GET /collections/{collectionId}/schema
curl -s "$BASE_URL/collections/$COLLECTION/schema?f=json"

# GET /collections/{collectionId}/queryables
curl -s "$BASE_URL/collections/$COLLECTION/queryables?f=json"

# GET /collections/{collectionId}/queryables con subset di proprieta
curl -s "$BASE_URL/collections/$COLLECTION/queryables?f=json&properties=name,datetime"

# GET /collections/{collectionId}/queryables con domini correnti
curl -s "$BASE_URL/collections/$COLLECTION/queryables?f=json&profile=actual-domain"
```

### Features e Records

```bash
# GET /collections/{collectionId}/items
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json"

# GET /collections/{collectionId}/items con paginazione
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&offset=10&limit=10"

# GET /collections/{collectionId}/items con bbox
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&bbox=-180,-90,180,90"

# GET /collections/{collectionId}/items con bbox-crs
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&bbox=-8794239,5311971,-8348961,5621521&bbox-crs=http://www.opengis.net/def/crs/EPSG/0/3857"

# GET /collections/{collectionId}/items con datetime
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&datetime=2026-05-26T00:00:00Z"

# GET /collections/{collectionId}/items con intervallo datetime
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&datetime=2026-01-01T00:00:00Z/2026-05-26T23:59:59Z"

# GET /collections/{collectionId}/items con sort
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&sortby=-datetime"

# GET /collections/{collectionId}/items con selezione proprieta
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&properties=name,datetime"

# GET /collections/{collectionId}/items senza geometria
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&skipGeometry=true"

# GET /collections/{collectionId}/items con ricerca testuale
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&q=temperature"

# GET /collections/{collectionId}/items con filtro proprieta provider
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&name=station-a"

# GET /collections/{collectionId}/items con CQL2 text
curl -s --get "$BASE_URL/collections/$COLLECTION/items" \
  --data-urlencode "f=json" \
  --data-urlencode "filter=temperature > 20" \
  --data-urlencode "filter-lang=cql-text"

# GET /collections/{collectionId}/items con CRS di output Features
curl -s "$BASE_URL/collections/$COLLECTION/items?f=json&crs=http://www.opengis.net/def/crs/EPSG/0/3857"

# POST /collections/{collectionId}/items con CQL2 JSON
curl -s -X POST "$BASE_URL/collections/$COLLECTION/items?f=json" \
  -H "Content-Type: application/json" \
  -d '{
    "op": ">",
    "args": [
      {"property": "temperature"},
      20
    ]
  }'

# POST /collections/{collectionId}/items per create transaction
curl -i -X POST "$BASE_URL/collections/$COLLECTION/items" \
  -H "Content-Type: application/geo+json" \
  -d '{
    "type": "Feature",
    "id": "new-feature-1",
    "geometry": {
      "type": "Point",
      "coordinates": [12.4924, 41.8902]
    },
    "properties": {
      "name": "sample",
      "datetime": "2026-05-26T00:00:00Z"
    }
  }'

# OPTIONS /collections/{collectionId}/items
curl -i -X OPTIONS "$BASE_URL/collections/$COLLECTION/items"

# GET /collections/{collectionId}/items/{itemId}
curl -s "$BASE_URL/collections/$COLLECTION/items/$ITEM_ID?f=json"

# GET /collections/{collectionId}/items/{itemId} con CRS di output
curl -s "$BASE_URL/collections/$COLLECTION/items/$ITEM_ID?f=json&crs=http://www.opengis.net/def/crs/EPSG/0/3857"

# PUT /collections/{collectionId}/items/{itemId}
curl -i -X PUT "$BASE_URL/collections/$COLLECTION/items/$ITEM_ID" \
  -H "Content-Type: application/geo+json" \
  -d '{
    "type": "Feature",
    "id": "371",
    "geometry": {
      "type": "Point",
      "coordinates": [12.4924, 41.8902]
    },
    "properties": {
      "name": "updated sample",
      "datetime": "2026-05-26T00:00:00Z"
    }
  }'

# DELETE /collections/{collectionId}/items/{itemId}
curl -i -X DELETE "$BASE_URL/collections/$COLLECTION/items/$ITEM_ID"

# OPTIONS /collections/{collectionId}/items/{itemId}
curl -i -X OPTIONS "$BASE_URL/collections/$COLLECTION/items/$ITEM_ID"
```

### Coverages

```bash
# GET /collections/{collectionId}/coverage come CoverageJSON
curl -s "$BASE_URL/collections/$COLLECTION/coverage?f=json"

# GET /collections/{collectionId}/coverage con formato nativo provider
curl -L -o coverage.bin "$BASE_URL/collections/$COLLECTION/coverage?f=NetCDF"

# GET /collections/{collectionId}/coverage con properties
curl -s "$BASE_URL/collections/$COLLECTION/coverage?f=json&properties=temperature,pressure"

# GET /collections/{collectionId}/coverage con subset
curl -s "$BASE_URL/collections/$COLLECTION/coverage?f=json&subset=lat(40:45)&subset=lon(10:15)"

# GET /collections/{collectionId}/coverage con bbox
curl -s "$BASE_URL/collections/$COLLECTION/coverage?f=json&bbox=10,40,15,45"

# GET /collections/{collectionId}/coverage con bbox-crs e datetime
curl -s "$BASE_URL/collections/$COLLECTION/coverage?f=json&bbox=10,40,15,45&bbox-crs=http://www.opengis.net/def/crs/OGC/1.3/CRS84&datetime=2026-05-26T00:00:00Z"
```

### Maps

```bash
# GET /collections/{collectionId}/map
curl -L -o map.png "$BASE_URL/collections/$COLLECTION/map?f=png"

# GET /collections/{collectionId}/map con bbox e dimensioni
curl -L -o map.png "$BASE_URL/collections/$COLLECTION/map?f=png&bbox=10,40,15,45&width=800&height=600&transparent=true"

# GET /collections/{collectionId}/map con CRS
curl -L -o map.png "$BASE_URL/collections/$COLLECTION/map?f=png&bbox=10,40,15,45&bbox-crs=http://www.opengis.net/def/crs/OGC/1.3/CRS84&crs=http://www.opengis.net/def/crs/EPSG/0/3857"

# GET /collections/{collectionId}/map con datetime e subset
curl -L -o map.png "$BASE_URL/collections/$COLLECTION/map?f=png&bbox=10,40,15,45&datetime=2026-05-26T00:00:00Z&subset=vertical(435)"

# GET /collections/{collectionId}/styles/{styleId}/map
curl -L -o styled-map.png "$BASE_URL/collections/$COLLECTION/styles/default/map?f=png&bbox=10,40,15,45&width=800&height=600"
```

### Tiles

```bash
# GET /collections/{collectionId}/tiles
curl -s "$BASE_URL/collections/$COLLECTION/tiles?f=json"

# GET /collections/{collectionId}/tiles/{tileMatrixSetId}
curl -s "$BASE_URL/collections/$COLLECTION/tiles/$TMS?f=json"

# GET /collections/{collectionId}/tiles/{tileMatrixSetId}/metadata
curl -s "$BASE_URL/collections/$COLLECTION/tiles/$TMS/metadata?f=json"

# GET /collections/{collectionId}/tiles/{tileMatrixSetId}/metadata come TileJSON, se supportato
curl -s "$BASE_URL/collections/$COLLECTION/tiles/$TMS/metadata?f=tilejson"

# GET /collections/{collectionId}/tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}
curl -L -o tile.mvt "$BASE_URL/collections/$COLLECTION/tiles/$TMS/$TILE_MATRIX/$TILE_ROW/$TILE_COL?f=mvt"

# GET tile raster
curl -L -o tile.png "$BASE_URL/collections/$COLLECTION/tiles/$TMS/$TILE_MATRIX/$TILE_ROW/$TILE_COL?f=png"
```

### Processes e jobs

```bash
# GET /processes
curl -s "$BASE_URL/processes?f=json"

# GET /processes con limit
curl -s "$BASE_URL/processes?f=json&limit=10"

# GET /processes/{processId}
curl -s "$BASE_URL/processes/$PROCESS_ID?f=json"

# POST /processes/{processId}/execution sincrono
curl -s -X POST "$BASE_URL/processes/$PROCESS_ID/execution" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "name": "World"
    },
    "response": "document"
  }'

# POST /processes/{processId}/execution asincrono
curl -i -X POST "$BASE_URL/processes/$PROCESS_ID/execution" \
  -H "Content-Type: application/json" \
  -H "Prefer: respond-async" \
  -d '{
    "inputs": {
      "name": "World"
    },
    "outputs": {
      "echo": {}
    },
    "response": "raw"
  }'

# POST /processes/{processId}/execution con subscriber callback
curl -i -X POST "$BASE_URL/processes/$PROCESS_ID/execution" \
  -H "Content-Type: application/json" \
  -H "Prefer: respond-async" \
  -d '{
    "inputs": {
      "name": "World"
    },
    "response": "document",
    "subscriber": {
      "successUri": "https://example.org/process/success",
      "inProgressUri": "https://example.org/process/progress",
      "failedUri": "https://example.org/process/failed"
    }
  }'

# GET /jobs
curl -s "$BASE_URL/jobs?f=json"

# GET /jobs con paginazione
curl -s "$BASE_URL/jobs?f=json&offset=0&limit=10"

# GET /jobs/{jobId}
curl -s "$BASE_URL/jobs/$JOB_ID?f=json"

# GET /jobs/{jobId}/results
curl -s "$BASE_URL/jobs/$JOB_ID/results?f=json"

# DELETE /jobs/{jobId}
curl -i -X DELETE "$BASE_URL/jobs/$JOB_ID"
```

### EDR

```bash
# GET /collections/{collectionId}/instances
curl -s "$BASE_URL/collections/$COLLECTION/instances?f=json"

# GET /collections/{collectionId}/instances/{instanceId}
curl -s "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID?f=json"

# GET /collections/{collectionId}/position
curl -s --get "$BASE_URL/collections/$COLLECTION/position" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=POINT(12.4924 41.8902)" \
  --data-urlencode "parameter-name=temperature"

# GET /collections/{collectionId}/area
curl -s --get "$BASE_URL/collections/$COLLECTION/area" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=POLYGON((12 41,13 41,13 42,12 42,12 41))" \
  --data-urlencode "datetime=2026-05-26T00:00:00Z"

# GET /collections/{collectionId}/cube
curl -s "$BASE_URL/collections/$COLLECTION/cube?f=json&bbox=10,40,15,45&datetime=2026-05-26T00:00:00Z&parameter-name=temperature"

# GET /collections/{collectionId}/radius
curl -s --get "$BASE_URL/collections/$COLLECTION/radius" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=POINT(12.4924 41.8902)" \
  --data-urlencode "within=10" \
  --data-urlencode "within-units=km"

# GET /collections/{collectionId}/trajectory
curl -s --get "$BASE_URL/collections/$COLLECTION/trajectory" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=LINESTRING(12 41,13 42,14 43)"

# GET /collections/{collectionId}/corridor
curl -s --get "$BASE_URL/collections/$COLLECTION/corridor" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=LINESTRING(12 41,13 42,14 43)" \
  --data-urlencode "corridor-width=5" \
  --data-urlencode "width-units=km" \
  --data-urlencode "corridor-height=100" \
  --data-urlencode "height-units=m"

# GET /collections/{collectionId}/locations
curl -s "$BASE_URL/collections/$COLLECTION/locations?f=json&bbox=10,40,15,45&limit=10"

# GET /collections/{collectionId}/locations/{locationId}
curl -s "$BASE_URL/collections/$COLLECTION/locations/$LOCATION_ID?f=json&parameter-name=temperature"

# GET /collections/{collectionId}/instances/{instanceId}/position
curl -s --get "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/position" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=POINT(12.4924 41.8902)"

# GET /collections/{collectionId}/instances/{instanceId}/area
curl -s --get "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/area" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=POLYGON((12 41,13 41,13 42,12 42,12 41))"

# GET /collections/{collectionId}/instances/{instanceId}/cube
curl -s "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/cube?f=json&bbox=10,40,15,45&parameter-name=temperature"

# GET /collections/{collectionId}/instances/{instanceId}/radius
curl -s --get "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/radius" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=POINT(12.4924 41.8902)" \
  --data-urlencode "within=10" \
  --data-urlencode "within-units=km"

# GET /collections/{collectionId}/instances/{instanceId}/trajectory
curl -s --get "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/trajectory" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=LINESTRING(12 41,13 42,14 43)"

# GET /collections/{collectionId}/instances/{instanceId}/corridor
curl -s --get "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/corridor" \
  --data-urlencode "f=json" \
  --data-urlencode "coords=LINESTRING(12 41,13 42,14 43)" \
  --data-urlencode "corridor-width=5" \
  --data-urlencode "width-units=km"

# GET /collections/{collectionId}/instances/{instanceId}/locations
curl -s "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/locations?f=json&bbox=10,40,15,45"

# GET /collections/{collectionId}/instances/{instanceId}/locations/{locationId}
curl -s "$BASE_URL/collections/$COLLECTION/instances/$INSTANCE_ID/locations/$LOCATION_ID?f=json&parameter-name=temperature"
```

### STAC

```bash
# GET /stac-api
curl -s "$BASE_URL/stac-api?f=json"

# GET /stac-api/search
curl -s "$BASE_URL/stac-api/search?bbox=10,40,15,45&datetime=2026-01-01T00:00:00Z/2026-05-26T23:59:59Z&limit=10"

# POST /stac-api/search
curl -s -X POST "$BASE_URL/stac-api/search" \
  -H "Content-Type: application/json" \
  -d '{
    "bbox": [10, 40, 15, 45],
    "datetime": "2026-01-01T00:00:00Z/2026-05-26T23:59:59Z",
    "limit": 10,
    "offset": 0
  }'

# GET /stac
curl -s "$BASE_URL/stac?f=json"

# GET /stac/{path}
curl -s "$BASE_URL/stac/$STAC_PATH?f=json"
```

### Admin API

```bash
# GET /admin/config
curl -s "$BASE_URL/admin/config?f=json"

# PUT /admin/config
curl -i -X PUT "$BASE_URL/admin/config" \
  -H "Content-Type: application/json" \
  -d '{
    "server": {
      "url": "http://localhost:5000",
      "bind": {
        "host": "0.0.0.0",
        "port": 5000
      },
      "mimetype": "application/json",
      "encoding": "utf-8",
      "language": "en-US"
    },
    "logging": {
      "level": "INFO"
    },
    "metadata": {
      "identification": {
        "title": "pygeoapi",
        "description": "Example API",
        "keywords": ["geospatial"],
        "keywords_type": "theme",
        "terms_of_service": "https://example.org/terms",
        "url": "https://example.org"
      },
      "license": {
        "name": "CC-BY-4.0",
        "url": "https://creativecommons.org/licenses/by/4.0/"
      },
      "provider": {
        "name": "Example",
        "url": "https://example.org"
      },
      "contact": {
        "name": "Example",
        "email": "info@example.org",
        "url": "https://example.org"
      }
    },
    "resources": {}
  }'

# PATCH /admin/config
curl -i -X PATCH "$BASE_URL/admin/config" \
  -H "Content-Type: application/json" \
  -d '{
    "server": {
      "pretty_print": true
    }
  }'

# GET /admin/config/resources
curl -s "$BASE_URL/admin/config/resources?f=json"

# POST /admin/config/resources
curl -i -X POST "$BASE_URL/admin/config/resources" \
  -H "Content-Type: application/json" \
  -d '{
    "new-collection": {
      "type": "collection",
      "title": "New collection",
      "description": "Example collection",
      "keywords": ["example"],
      "extents": {
        "spatial": {
          "bbox": [-180, -90, 180, 90],
          "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
        }
      },
      "providers": [
        {
          "type": "feature",
          "name": "GeoJSON",
          "data": "/data/new-collection.geojson",
          "id_field": "id"
        }
      ]
    }
  }'

# GET /admin/config/resources/{resourceId}
curl -s "$BASE_URL/admin/config/resources/$RESOURCE_ID?f=json"

# PUT /admin/config/resources/{resourceId}
curl -i -X PUT "$BASE_URL/admin/config/resources/$RESOURCE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "collection",
    "title": "Replaced collection",
    "description": "Full replacement example",
    "keywords": ["example"],
    "extents": {
      "spatial": {
        "bbox": [-180, -90, 180, 90],
        "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
      }
    },
    "providers": [
      {
        "type": "feature",
        "name": "GeoJSON",
        "data": "/data/replaced.geojson",
        "id_field": "id"
      }
    ]
  }'

# PATCH /admin/config/resources/{resourceId}
curl -i -X PATCH "$BASE_URL/admin/config/resources/$RESOURCE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title",
    "visibility": "default"
  }'

# DELETE /admin/config/resources/{resourceId}
curl -i -X DELETE "$BASE_URL/admin/config/resources/$RESOURCE_ID"
```

## Core API

### `GET /`

Restituisce la landing page OGC API con link HATEOAS ai servizi abilitati:

- `service-desc`: `/openapi`
- `service-doc`: `/openapi?f=html`
- `conformance`: `/conformance`
- `data`: `/collections`
- `processes`: `/processes`
- `tiling-schemes`: `/TileMatrixSets`
- `job-list`: `/jobs`, solo se process manager asincrono
- `hub`: broker Pub/Sub, solo se configurato e non hidden
- AsyncAPI links, solo se `PYGEOAPI_ASYNCAPI`/config sono attivi

### `GET /openapi`

Restituisce il documento OpenAPI generato dalla configurazione.

Parametri:

- `f=json`: documento `application/vnd.oai.openapi+json;version=3.0`
- `f=html`: Swagger UI
- `f=html&ui=redoc`: ReDoc UI

La documentazione stabile indica OpenAPI 3.0.2. Dopo modifiche a config/resources va rigenerato o ricaricato il documento OpenAPI runtime.

### `GET /asyncapi`

Restituisce AsyncAPI 3.0.0 se Pub/Sub e abilitato.

Parametri:

- `f=json`: documento `application/asyncapi+json`
- `f=html`: UI HTML

Se non configurato, risponde `501 Not Implemented`.

### `GET /conformance`

Restituisce `conformsTo` aggregando:

- OGC API Common core, landing page, JSON, HTML, OAS 3.0, collections
- classi Features o Records se ci sono provider `feature` o `record`
- classi Coverages, Maps, Tiles, Processes, EDR, STAC, Pub/Sub se abilitate dai provider/config

## Collections API

### `GET /collections`

Lista le collection `type: collection` visibili. Le collection `visibility: hidden` non compaiono nella lista, ma possono essere richiamate direttamente se configurate.

Parametri comuni:

- `f=json|html|jsonld`
- `lang=<locale>`

### `GET /collections/{collectionId}`

Restituisce metadata, extent, CRS, links e affordance della singola collection. I link dipendono dai provider presenti:

- `feature` o `record`: `items`, `queryables`, `schema`
- `coverage`: `coverage`, `schema`
- `tile`: `tiles`
- `map`: `map`
- `edr`: `data_queries` per i query type supportati

## Queryables e schema

### `GET /collections/{collectionId}/schema`

Restituisce un JSON Schema (`application/schema+json`) costruito dai campi provider. Supporta feature, coverage, record ed EDR.

Parametri:

- `f=json|html`
- `lang=<locale>`

### `GET /collections/{collectionId}/queryables`

Restituisce le proprieta interrogabili per provider `feature`, `coverage` o `record`.

Parametri:

- `f=json|html`
- `properties=a,b`: limita il set di queryables
- `profile=actual-domain`: prova a includere domini/valori correnti se il provider implementa `get_domains`

## OGC API - Features e Records

Le API Features e Records condividono gli endpoint `/collections/{collectionId}/items*`. Il provider `feature` viene cercato prima; se assente viene usato `record`.

### `GET /collections/{collectionId}/items`

Restituisce una GeoJSON FeatureCollection o una rappresentazione alternativa.

Parametri principali:

- `f=json|html|jsonld|<formatter>`: output, ad esempio `csv` se configurato
- `offset=<int>`: offset paginazione, default `0`
- `limit=<int>`: limite item; valutato contro `server.limits` e `resource.limits`
- `resulttype=results|hits`: risultati completi o solo conteggio se supportato
- `bbox=minx,miny,maxx,maxy` oppure 6D
- `bbox-crs=<crs-uri>`: CRS del bbox; richiede `bbox`
- `datetime=<instant>` o `<start>/<end>`
- `sortby=field,-field,+field`
- `properties=a,b`: seleziona proprieta da restituire
- `skipGeometry=true|false`
- `q=<text>`: ricerca full text se supportata
- `filter=<CQL2 text>`: filtro CQL text
- `filter-lang=cql-text|cql-json`
- `filter-crs=<crs-uri>`: CRS del filtro CQL
- `crs=<crs-uri>`: solo Features, CRS di output
- filtri proprieta: qualsiasi query param non riservato che corrisponde a un campo provider, oppure extra param se il provider abilita `include_extra_query_parameters`

### `POST /collections/{collectionId}/items`

Il comportamento dipende dal `Content-Type`:

- `application/json`: query CQL2 JSON, equivalente funzionale di `GET` con filtro
- `application/geo+json`: create transaction se provider `editable: true`

### `GET /collections/{collectionId}/items/{itemId}`

Restituisce una singola feature/record. Per Features accetta `crs=<crs-uri>`.

### Transactions

pygeoapi implementa la bozza OGC API - Features Part 4 per feature e record, ma solo se il provider supporta CUD ed e configurato con `editable: true`.

| Metodo | Path | Effetto |
|---|---|---|
| POST | `/collections/{collectionId}/items` | Create, payload GeoJSON |
| PUT | `/collections/{collectionId}/items/{itemId}` | Replace/update |
| DELETE | `/collections/{collectionId}/items/{itemId}` | Delete |
| OPTIONS | `/collections/{collectionId}/items[/{itemId}]` | Metodi ammessi |

Se Pub/Sub e configurato, create/update/delete generano un CloudEvent su topic `collections/{collectionId}`.

## OGC API - Coverages

### `GET /collections/{collectionId}/coverage`

Richiede un provider `coverage`.

Parametri:

- `f=json`: CoverageJSON (`application/prs.coverage+json`)
- `f=<native-format>`: formato nativo del provider, ad esempio GRIB, NetCDF, Zarr
- `bbox=minx,miny,maxx,maxy`
- `bbox-crs=<crs-uri>`
- `datetime=<instant>` o `<start>/<end>`
- `properties=a,b`: range/field da restituire
- `subset=axis(value)` o `subset=axis(min:max)`: subset per assi provider

Provider core principali: `rasterio`, `xarray`.

## OGC API - Maps

### `GET /collections/{collectionId}/map`
### `GET /collections/{collectionId}/styles/{styleId}/map`

Richiede un provider `map`.

Parametri:

- `f=<format>`: default `png`, coerente con `provider.format.name`
- `bbox=minx,miny,maxx,maxy`: default globale se omesso
- `bbox-crs=<crs-uri>`: default CRS84
- `crs=<crs-uri>`: CRS della mappa restituita
- `width=<int>`: default `500`
- `height=<int>`: default `300`
- `transparent=true|false`
- `datetime=<instant>` o `<start>/<end>`
- `subset=axis(value|min:max)` per estensioni non spaziali/temporali configurate
- `properties=a,b` se il provider espone campi selezionabili

Header risposta rilevanti:

- `Content-Type`: MIME del formato provider
- `Content-Crs`
- `Content-Bbox`

Provider core: `MapScript`, `WMSFacade`.

## OGC API - Tiles

### `GET /TileMatrixSets`

Lista Tile Matrix Set supportati. Nel sorgente sono usati enum/definizioni come `WebMercatorQuad` e `WorldCRS84Quad`.

Parametri:

- `f=json|html`

### `GET /TileMatrixSets/{tileMatrixSetId}`

Restituisce definizione del Tile Matrix Set.

Parametri:

- `f=json|html`

### `GET /collections/{collectionId}/tiles`

Restituisce tilesets e link ai template delle tile.

Parametri:

- `f=json|html|jsonld`

### `GET /collections/{collectionId}/tiles/{tileMatrixSetId}`
### `GET /collections/{collectionId}/tiles/{tileMatrixSetId}/metadata`

Restituisce metadata del tileset. I provider possono restituire metadata OGC o TileJSON.

Parametri:

- `f=json|html|tilejson` in base al provider e alla validazione route

### `GET /collections/{collectionId}/tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}`

Restituisce il tile. Richiede `f=<provider-format>`, ad esempio `mvt`, `png`, `jpeg`.

Provider core:

- Vector tile: `MVT-tippecanoe`, `MVT-elastic`, `MVT-proxy`, `MVT-postgresql`
- Raster/tile facade: `WMTSFacade`

## OGC API - Processes

### `GET /processes`

Lista processi configurati. Nella lista, pygeoapi rimuove `inputs`, `outputs` ed `example` per risposta compatta.

Parametri:

- `f=json|html|jsonld`
- `limit=<int>`

### `GET /processes/{processId}`

Restituisce descrizione completa del processo:

- `id`
- `title`, `description`, `keywords`, `metadata`
- `inputs`
- `outputs`
- `jobControlOptions`
- `outputTransmission`
- link di execute e jobs

### `POST /processes/{processId}/execution`

Esegue un processo.

Header:

- `Prefer: respond-async`: richiede esecuzione asincrona se supportata

Body JSON:

```json
{
  "inputs": {
    "name": "World"
  },
  "outputs": {
    "message": {}
  },
  "response": "raw",
  "subscriber": {
    "successUri": "https://example.org/success",
    "inProgressUri": "https://example.org/progress",
    "failedUri": "https://example.org/failed"
  }
}
```

Campi:

- `inputs`: input del processo
- `outputs`: output richiesti
- `response=raw|document`: formato risposta OGC API Processes
- `subscriber.successUri`: callback obbligatoria se `subscriber` e presente

Risposte:

- `200 OK`: esecuzione sincrona completata
- `201 Created`: job accettato/asinc, con `Location: /jobs/{jobId}`
- `400 Bad Request`: fallimento processo o request invalida

Processi core registry: `HelloWorld`, `ShapelyFunctions`, `Echo`.

### Jobs

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/jobs?limit=&offset=` | Lista job, ordinata per `started` decrescente nel layer API. |
| GET | `/jobs/{jobId}` | Stato job. |
| GET | `/jobs/{jobId}/results` | Risultati; se job running/accepted risponde `ResultNotReady`. |
| DELETE | `/jobs/{jobId}` | Dismiss job e restituisce stato `dismissed`. |

Process manager core: `Dummy`, `TinyDB`, `MongoDB`, `PostgreSQL`.

## OGC API - Environmental Data Retrieval

Richiede provider `edr`. I query type effettivi sono quelli restituiti dal provider con `get_query_types()`.

### Instances

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/collections/{collectionId}/instances` | Lista istanze disponibili. |
| GET | `/collections/{collectionId}/instances/{instanceId}` | Dettaglio istanza. |

### Query data

Path senza istanza:

- `/collections/{collectionId}/position`
- `/collections/{collectionId}/area`
- `/collections/{collectionId}/cube`
- `/collections/{collectionId}/radius`
- `/collections/{collectionId}/trajectory`
- `/collections/{collectionId}/corridor`
- `/collections/{collectionId}/locations`
- `/collections/{collectionId}/locations/{locationId}`

Path con istanza:

- `/collections/{collectionId}/instances/{instanceId}/position`
- `/collections/{collectionId}/instances/{instanceId}/area`
- `/collections/{collectionId}/instances/{instanceId}/cube`
- `/collections/{collectionId}/instances/{instanceId}/radius`
- `/collections/{collectionId}/instances/{instanceId}/trajectory`
- `/collections/{collectionId}/instances/{instanceId}/corridor`
- `/collections/{collectionId}/instances/{instanceId}/locations`
- `/collections/{collectionId}/instances/{instanceId}/locations/{locationId}`

Parametri comuni:

- `f=json|html|jsonld|<formatter>`: default JSON serializzato come CoverageJSON (`application/vnd.cov+json`)
- `datetime=<instant>` o `<start>/<end>`
- `parameter-name=a,b`: parametri/variabili EDR da selezionare
- `crs=<crs-uri>`: CRS di output se supportato
- `limit=<int>`
- `z=<value>`: coordinata verticale o altro asse

Parametri per query type:

- `coords=<WKT>`: richiesto per `position`, `area`, `radius`, `trajectory`, `corridor`
- `bbox=minx,miny,maxx,maxy`: usato da `cube` e `locations`; obbligatorio per `cube`
- `within=<number>` e `within-units=<UCUM>`: `radius`
- `corridor-width`, `width-units`, `corridor-height`, `height-units`: `corridor`
- `locationId`: nel path per `locations/{locationId}`

Provider core: `xarray-edr`, `SensorThingsEDR`.

## STAC

pygeoapi ha due modalita STAC distinte.

### Static STAC catalog

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/stac` | Root catalog statico. |
| GET | `/stac/{path}` | Browse di catalog, collection, item o asset. |

Richiede risorse `type: stac-collection` con provider `stac`, ad esempio `FileSystem`, `AzureBlobStorage`, `Hateoas`.

### STAC API

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/stac-api` | Landing page STAC API con conformsTo core/item-search. |
| GET | `/stac-api/search` | Item Search via query string. |
| POST | `/stac-api/search` | Item Search via JSON body. |

La STAC API lavora come wrapper su risorse `type: stac-collection` che hanno provider `feature` o `record`. Internamente riusa `get_collection_items`, quindi supporta i parametri Features/Records disponibili: `bbox`, `datetime`, `limit`, `offset`, filtri, sorting e output JSON.

POST body supportato dal sorgente:

- `bbox`: array convertito in query param `bbox`
- `datetime`
- `limit`
- `offset`

Il risultato e una STAC FeatureCollection con `stac_version`, `bbox`, `links`, `assets` normalizzati quando mancanti.

## Admin API

Si abilita con:

```yaml
server:
  admin: true
```

Le route Admin sono registrate su blueprint separato e compaiono in OpenAPI solo se l'Admin API e abilitata prima della generazione del documento.

| Metodo | Path | Body | Risposta |
|---|---|---|---|
| GET | `/admin/config` | n/a | Config completa, JSON o HTML. |
| PUT | `/admin/config` | Config completa JSON | `204 No Content`; valida config e rigenera OpenAPI. |
| PATCH | `/admin/config` | Patch JSON parziale | `204 No Content`; merge ricorsivo. |
| GET | `/admin/config/resources` | n/a | Oggetto `resources`. |
| POST | `/admin/config/resources` | Oggetto `{resourceId: resourceConfig}` | `201 Created`; fallisce se esiste gia. |
| GET | `/admin/config/resources/{resourceId}` | n/a | Config risorsa. |
| PUT | `/admin/config/resources/{resourceId}` | Resource config completa | `204 No Content`. |
| PATCH | `/admin/config/resources/{resourceId}` | Patch parziale resource | `204 No Content`. |
| DELETE | `/admin/config/resources/{resourceId}` | n/a | `204 No Content`. |

Il codice valida con lo schema configurazione, preserva environment variables nel file raw e riscrive sia `PYGEOAPI_CONFIG` sia `PYGEOAPI_OPENAPI`.

## Pub/Sub e AsyncAPI

Pub/Sub e opzionale e implementa notifiche CloudEvents.

Broker core:

- `HTTP`
- `Kafka`
- `MQTT`

Eventi pubblicati:

- `create`, `update`, `delete` su feature/record transactions
- `process` su esecuzione processo/job result

Canali:

- `collections/{resourceId}` per transazioni item
- `processes/{processId}` per processi
- se `pubsub.broker.channel` e configurato, viene usato come prefisso

CloudEvent generato:

- `specversion: 1.0`
- `type`: `org.ogc.api.collection.item.create|update|delete` oppure `org.ogc.api.job.result`
- `source`: base URL pygeoapi
- `subject`: canale
- `datacontenttype`
- `data`

## Provider e plugin API interne

pygeoapi usa una registry in `pygeoapi.plugin.PLUGINS`. Un plugin core puo essere indicato per short name, mentre un plugin esterno puo essere indicato come dotted path Python.

### Provider core registry

| Tipo funzionale | Provider core |
|---|---|
| Features | `CSV`, `Elasticsearch`, `ERDDAPTabledap`, `ESRI`, `GeoJSON`, `MongoDB`, `MySQL`, `OracleDB`, `OGR`, `OpenSearch`, `Parquet`, `PostgreSQL`, `SensorThings`, `SQLiteGPKG`, `Socrata`, `TinyDB` |
| Records | `ElasticsearchCatalogue`, `TinyDBCatalogue`, `CSWFacade` |
| Coverages | `rasterio`, `xarray` |
| Maps | `MapScript`, `WMSFacade` |
| Tiles | `MVT-tippecanoe`, `MVT-elastic`, `MVT-proxy`, `MVT-postgresql`, `WMTSFacade` |
| EDR | `xarray-edr`, `SensorThingsEDR` |
| STAC | `FileSystem`, `AzureBlobStorage`, `Hateoas` |
| Pub/Sub | `HTTP`, `Kafka`, `MQTT` |
| Processes | `HelloWorld`, `ShapelyFunctions`, `Echo` |
| Process managers | `Dummy`, `MongoDB`, `TinyDB`, `PostgreSQL` |
| Formatters | `CSV` |

### `BaseProvider`

Contratto per provider feature, record, coverage e map.

Metodi/proprieta principali:

- `fields` / `get_fields()`: schema campi
- `get_schema(schema_type)`: schema item/queryables
- `get_metadata()`: metadata provider
- `get_domains(properties, current=False)`: domini validi/attuali se supportati
- `query(...)`: ricerca/lista dati
- `get(identifier, **kwargs)`: singolo item
- `create(item)`: transaction create
- `update(identifier, item)`: transaction update
- `delete(identifier)`: transaction delete

Attributi rilevanti usati dall'API:

- `type`
- `name`
- `data`
- `id_field`
- `time_field`
- `title_field`
- `uri_field`
- `editable`
- `properties`
- `include_extra_query_parameters`
- `filename`

### `BaseEDRProvider`

Estende `BaseProvider` con:

- `instances()`
- `instance(instanceId)`
- `get_query_types()`
- `query(**kwargs)`

### `BaseTileProvider`

Contratto tile:

- `get_layer()`
- `get_fields()`
- `get_tiling_schemes()`
- `get_tiles_service(...)`
- `get_tiles(layer, tileset, z, y, x, format_)`
- `get_metadata(...)`

### `BaseProcessor`

Contratto processi:

- `execute(data, outputs=None) -> (mimetype, value)`
- `set_job_id(job_id)`
- metadata processo in configurazione o classe plugin

## Configurazione API-relevant

Sezioni principali:

- `server.url`: base URL usato nei link
- `server.admin`: abilita Admin API
- `server.gzip`, `server.cors`, `server.pretty_print`
- `server.languages`, `server.language`, `server.locale_dir`
- `server.limits`: `default_items`, `max_items`, `on_exceed`
- `server.manager`: process manager asincrono
- `server.api_rules`: `api_version`, `strict_slashes`, `url_prefix`, `version_header`
- `pubsub`: broker Pub/Sub
- `metadata`: identification/provider/contact/license
- `resources`: collection, stac-collection e process definitions

Resource data tipiche:

```yaml
resources:
  obs:
    type: collection
    title: Observations
    description: Observation data
    keywords: [observations]
    extents:
      spatial:
        bbox: [-180, -90, 180, 90]
        crs: http://www.opengis.net/def/crs/OGC/1.3/CRS84
    providers:
      - type: feature
        name: GeoJSON
        data: tests/data/obs.geojson
        id_field: id
        time_field: datetime
```

## CQL e CRS

CQL:

- GET: `filter=<CQL2 text>` con `filter-lang=cql-text`
- POST: body CQL2 JSON su `/collections/{collectionId}/items`
- `filter-crs` indica CRS geometrie nel filtro
- supporto reale dipende dal provider

CRS:

- `bbox-crs`: Features, Maps, Coverages
- `filter-crs`: Features/Records con CQL
- `crs`: Features item output, EDR e Maps
- `storage_crs` nel provider definisce CRS dati interni

## Differenze importanti tra docs e sorgente

- Le docs stabili sono release `0.23.4` del 2026-04-27.
- Il sorgente analizzato e `master` commit `2433cea` del 2026-05-22.
- La route map e stata ricavata da `pygeoapi/flask_app.py`; Starlette e Django espongono le stesse API principali tramite adapter diversi.
- `pygeoapi.api.maps.get_collection_map_legend` esiste nel sorgente, ma non risulta registrato come route Flask/Starlette nel commit analizzato.
- STAC API `landing_page` nel sorgente contiene link search con doppio slash (`/stac-api//search`) nel link generato; la route reale e `/stac-api/search`.

## Fonti principali

- Repository: https://github.com/geopython/pygeoapi
- Route Flask: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/flask_app.py
- Core API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/__init__.py
- Features/Records API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/itemtypes.py
- Coverages API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/coverages.py
- Maps API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/maps.py
- Tiles API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/tiles.py
- Processes API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/processes.py
- EDR API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/environmental_data_retrieval.py
- STAC API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/stac.py
- Admin API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/admin.py
- Pub/Sub API: https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/pubsub.py
- Stable docs: https://docs.pygeoapi.io/en/stable/
- OpenAPI docs: https://docs.pygeoapi.io/en/stable/openapi.html
- Features docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-features.html
- Records docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-records.html
- Coverages docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-coverages.html
- Maps docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-maps.html
- Tiles docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-tiles.html
- EDR docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-edr.html
- STAC docs: https://docs.pygeoapi.io/en/stable/publishing/stac.html
- Processes docs: https://docs.pygeoapi.io/en/stable/publishing/ogcapi-processes.html
- Transactions docs: https://docs.pygeoapi.io/en/stable/transactions.html
- Admin API docs: https://docs.pygeoapi.io/en/stable/admin-api.html
- Pub/Sub docs: https://docs.pygeoapi.io/en/stable/pubsub.html
- Plugins docs: https://docs.pygeoapi.io/en/stable/plugins.html
