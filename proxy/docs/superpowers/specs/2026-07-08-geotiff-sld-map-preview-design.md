# GeoTIFF SLD Map Preview Design

## Obiettivo

Renderizzare negli output dei job una mappa per gli output composti da:

- un file GeoTIFF;
- un file Styled Layer Descriptor (SLD) che definisce lo stile di visualizzazione del GeoTIFF.

Gli output logici devono essere visualizzati come una sola card. Per esempio, i risultati salvati come `dem.geotiff` e `dem.sld` devono apparire come un unico output `Primary DEM`.

I file restano scaricabili separatamente. La preview mappa e i download devono passare da endpoint Laravel autorizzati tramite policy.

## Contesto

Oggi i risultati OGC vengono salvati in `process_execution_results` come file indipendenti. Gli output object di `pybox`, come `dem` e `invasion_map`, vengono espansi in risultati separati:

- `dem.geotiff`;
- `dem.sld`;
- `invasion_map.geotiff`;
- `invasion_map.sld`.

La pagina dettaglio job riceve una lista piatta in `execution.results` e renderizza ogni elemento con `ResultPreview`.

Il download esistente usa `ProcessExecutionResultController::download()`, autorizza il job con `Gate::authorize('view', $processExecution)`, verifica che il result appartenga al job, scarica/cache-a il file remoto on-demand quando necessario e serve il file locale.

## Decisioni

### Raggruppamento Visuale, Non Dati Aggregati

Non cambiare il modello dati dei risultati.

`dem.geotiff` e `dem.sld` restano record separati, con cache, media type, `remote_href`, `storage_path` e download separati.

La UI costruisce un gruppo visuale quando trova due risultati con lo stesso prefisso e componenti `geotiff` e `sld`. Il gruppo viene renderizzato come una sola card di output.

Questa scelta limita il rischio di regressione: il backend continua a trattare i file come risultati atomici, mentre la UI presenta l'output nel modo atteso dall'utente.

### Endpoint Protetti Per I File Preview

La preview non deve usare URL remoti diretti e non deve esporre file pubblici nello storage.

Aggiungere un endpoint dedicato per ottenere un result come file inline per preview, per esempio:

`GET /jobs/{processExecution}/results/{result}/preview-file`

L'endpoint deve:

1. autorizzare con `Gate::authorize('view', $processExecution)`;
2. verificare che `result.process_execution_id` coincida con il job richiesto;
3. accettare solo media type previsti per preview mappa, cioe GeoTIFF e SLD;
4. se `storage_path` manca e `remote_href` esiste, scaricare/cache-are il file tramite `OgcProcessesClient`;
5. restituire il file inline con `Content-Type` corretto;
6. restituire `404` se il file non puo essere recuperato.

Il download esistente resta invariato e continua a usare `Content-Disposition: attachment`.

### Rendering Mappa In Browser

La prima implementazione usa MapLibre GL JS con una canvas source.

La UI:

1. chiama gli endpoint preview-file protetti per GeoTIFF e SLD;
2. decodifica il GeoTIFF nel browser con una libreria JavaScript dedicata;
3. legge bounding box e dimensioni dal GeoTIFF quando disponibili;
4. converte lo SLD con GeoStyler in una rappresentazione intermedia;
5. applica best-effort le regole raster supportate, in particolare color map e fallback di opacita/colore;
6. disegna il raster in un canvas ridimensionato per la preview;
7. registra il canvas in MapLibre come `canvas` source e lo mostra con un layer `raster`.

Questo evita di introdurre subito una pipeline server-side per tile raster. Se in futuro i GeoTIFF risultano troppo grandi o complessi per la preview browser, lo stesso contratto UI puo essere mantenuto e l'endpoint puo evolvere verso tile o immagini generate server-side.

### Conversione SLD Best-Effort

La conversione SLD non deve bloccare la preview.

Se GeoStyler converte lo stile correttamente, la UI applica le parti supportate al canvas. Se la conversione fallisce o contiene regole non supportate, la mappa usa uno stile fallback e mostra un avviso leggero nella card.

Il file SLD originale resta sempre scaricabile.

## Frontend Design

### Grouping Helper

Aggiungere un helper, per esempio `groupProcessResults`, che riceve `ProcessExecutionResult[]` e restituisce una lista di item visuali:

- result singolo;
- gruppo GeoTIFF+SLD.

Un gruppo e valido quando:

- i due risultati hanno `outputId` nel formato `{output}.geotiff` e `{output}.sld`;
- i media type sono compatibili con GeoTIFF e SLD;
- entrambi appartengono alla stessa lista `execution.results`.

Se manca una delle due parti, i risultati restano separati e usano il renderer attuale.

### Output Group Card

Aggiungere un componente dedicato, per esempio `GeoTiffMapResultPreview`.

La card aggregata mostra:

- titolo dell'output logico, preferendo il titolo base derivato da `Primary DEM - ...` o dal prefisso output;
- descrizione dell'output quando disponibile;
- mappa MapLibre;
- pulsante download GeoTIFF;
- pulsante download SLD;
- stato di caricamento della preview;
- avviso di fallback stile quando lo SLD non e applicabile.

`ResultPreview` resta responsabile dei risultati non raggruppati.

La pagina `process-executions/show.tsx` usa la lista raggruppata per calcolare sia il rendering sia il conteggio visuale degli output.

### Mappa

Il componente mappa deve inizializzare MapLibre solo lato client, pulire l'istanza al dismount e non bloccare il rendering della pagina.

La preview canvas deve avere una dimensione massima stabile, per esempio 1024 o 2048 pixel sul lato lungo, per evitare memoria e tempi di rendering eccessivi.

Se il GeoTIFF non contiene bounding box leggibile, la card segnala preview non disponibile e mantiene i download. La prima implementazione non mostra raster non georeferenziati.

## Backend Design

### Controller

Estendere `ProcessExecutionResultController` o aggiungere un controller dedicato per la preview file.

Il comportamento di caching on-demand deve essere condiviso o estratto per evitare duplicazione fragile con `download()`.

La policy resta centrata sul job:

- `Gate::authorize('view', $processExecution)`;
- controllo esplicito che il result appartenga al job;
- nessun accesso diretto allo storage locale;
- nessun URL remoto inviato al browser.

### Route

Aggiungere una route autenticata, verificata e protetta da `EnsureUserIsActive`, nello stesso gruppo delle route job:

`GET /jobs/{processExecution}/results/{result}/preview-file`

La route deve essere generata con Wayfinder dopo la modifica delle route, seguendo il pattern esistente per `jobs.results.download`.

## Data Flow

1. Il job completa e salva risultati separati, per esempio `dem.geotiff` e `dem.sld`.
2. La pagina dettaglio riceve `execution.results`.
3. `groupProcessResults` crea un solo item visuale per `dem`.
4. La card `GeoTiffMapResultPreview` mostra i download separati e avvia il caricamento preview.
5. La UI richiede GeoTIFF e SLD agli endpoint preview-file.
6. Laravel autorizza il job, verifica ownership dei result e scarica/cache-a on-demand i file remoti se necessario.
7. La UI decodifica GeoTIFF e SLD, genera canvas e lo passa a MapLibre.
8. MapLibre mostra il canvas come layer raster.

## Error Handling

Se manca GeoTIFF o SLD, non viene creato il gruppo e i risultati restano separati.

Se l'endpoint preview-file ritorna `403` o `404`, la card mostra preview non disponibile e mantiene i download.

Se il GeoTIFF non e decodificabile, la card mostra preview non disponibile.

Se lo SLD non e convertibile, la card mostra la mappa con stile fallback e un avviso leggero.

Se il caching on-demand remoto fallisce, l'endpoint ritorna errore e non crea record incompleti. Il download continua ad avere lo stesso comportamento e le stesse policy.

## Dipendenze

La feature richiede nuove dipendenze frontend:

- `maplibre-gl` per la mappa;
- `geostyler-sld-parser` come parser GeoStyler per SLD;
- `geotiff` per decodificare GeoTIFF nel browser.

Non introdurre dipendenze PHP geospaziali nella prima implementazione.

## Test

### Frontend

Aggiungere test per `groupProcessResults`:

- `dem.geotiff` e `dem.sld` diventano un solo gruppo;
- `invasion_map.geotiff` e `invasion_map.sld` diventano un secondo gruppo;
- risultati non accoppiati restano separati;
- risultati con media type non compatibili non vengono raggruppati;
- il conteggio visuale usa il numero di gruppi piu risultati singoli.

Aggiungere test o controlli component-level per:

- presenza dei due link download nella card aggregata;
- fallback quando la preview mappa fallisce;
- avviso quando lo SLD non viene applicato.

Eseguire typecheck frontend dopo l'aggiunta delle dipendenze.

### Backend

Aggiungere feature test Pest per l'endpoint preview-file:

- l'owner del job puo leggere GeoTIFF e SLD inline;
- un altro utente riceve `403`;
- un result appartenente a un altro job viene rifiutato con `404`;
- un result con media type non ammesso viene rifiutato;
- un result `metadata_only` con `remote_href` viene scaricato e cache-ato on-demand;
- un result senza `storage_path` e senza `remote_href` ritorna `404`.

Eseguire i test backend focalizzati e `vendor/bin/pint --dirty --format agent` dopo modifiche PHP.

## Non-Goals

- Non unificare fisicamente i record `ProcessExecutionResult`.
- Non sostituire i download esistenti.
- Non rendere pubblici i file nello storage.
- Non implementare tile server o conversione server-side GeoTIFF nella prima iterazione.
- Non garantire fedelta completa di ogni regola SLD nella prima iterazione.
