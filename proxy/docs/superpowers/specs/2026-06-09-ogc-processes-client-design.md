# OGC API - Processes Client Design

## Obiettivo

Realizzare un client web Laravel per interagire con un SaaS pygeoapi conforme a OGC API - Processes.
Il client deve offrire alla comunita INGV una UI user-friendly per scoprire processi, compilare input, avviare esecuzioni, seguire job asincroni e consultare storico e risultati.

Il primo rilascio deve essere generico rispetto allo standard OGC API - Processes, ma validato sui tre processi attualmente esposti dal SaaS INGV:

- `solwcad`
- `conduit`
- `pybox`

La base URL predefinita e configurabile e:

```text
https://voice.pi.ingv.it/geoinquire/
```

## Contesto Tecnico

L'applicazione esistente usa Laravel 13, Inertia React 3, React 19, Tailwind CSS 4, shadcn/ui, Fortify, Horizon e Pest.

Il SaaS remoto espone:

- landing page OGC JSON con link a processi, job, conformance e OpenAPI;
- `/processes` con lista dei processi disponibili;
- `/processes/{processID}?f=json` con descrizione input/output;
- `/processes/{processID}/execution` per POST execution;
- `/jobs/{jobID}` per lo stato;
- `/jobs/{jobID}/results` per il recupero risultati.

Il SaaS esterno non usa autenticazione applicativa. Il client Laravel deve quindi diventare il sistema locale autorevole per utenti, payload originali, storico richieste, stato job, notifiche e metadati dei risultati.

Per l'MVP le pagine operative OGC richiedono autenticazione. Un catalogo processi pubblico puo essere valutato in seguito, ma non e necessario per soddisfare dashboard, storico e notifiche.

## Decisioni Di Architettura

Usiamo una service class applicativa come integrazione primaria:

- `App\Services\Ogc\OgcProcessesClient`
- configurazione in `config/services.php`;
- HTTP client Laravel con timeout, connect timeout, retry ragionato e `Http::fake` nei test;
- nessuna business logic in un service provider.

Un service provider dedicato resta opzionale. Sara introdotto solo se serviranno binding multipli, interfacce, macro HTTP o configurazioni piu complesse.

L'architettura separa:

- client HTTP remoto;
- normalizzazione schema OGC;
- azioni applicative;
- persistenza locale;
- controller Inertia sottili;
- rendering React/shadcn.

## Componenti Backend

### Client SaaS

`OgcProcessesClient` incapsula tutte le chiamate remote:

- `landingPage()`
- `processes()`
- `process(string $processId)`
- `execute(string $processId, array $payload, ExecutionPreference $preference)`
- `job(string $jobId)`
- `jobResults(string $jobId)`

Il client restituisce array/DTO applicativi e lascia ai chiamanti la decisione su persistenza e UI.

### Normalizzazione Schema

`ProcessSchemaNormalizer` converte la descrizione JSON OGC in una struttura stabile per il frontend.

Tipi normalizzati previsti:

- `scalar`: string, number, integer, boolean;
- `enum`: select;
- `object`: gruppo di campi;
- `oneOf`: selettore di variante e sotto-form;
- `array<object>`: righe ripetibili;
- `array<array>`: editor tabellare, necessario per `solwcad`;
- `file/reference`: predisposizione per upload file, URL e input by-reference;
- `output`: output selezionabile con transmission mode `value` o `reference`.

Il frontend non renderizza JSON Schema grezzo. Renderizza solo il formato normalizzato.

### Azioni Applicative

Le azioni principali sono:

- `StartProcessExecution`: valida input, costruisce payload OGC, salva esecuzione locale e invia POST execution;
- `PollProcessExecution`: aggiorna stato remoto da `/jobs/{jobID}`;
- `StoreProcessResult`: recupera risultati, salva metadati, preview e cache selettiva;
- `RefreshProcessCatalog`: recupera e cachea lista processi e descrizioni.

### Queue E Notifiche

Le esecuzioni asincrone dispatchano un job di polling.
Horizon gestisce i worker.

Il polling termina quando il job remoto risulta:

- `successful`
- `failed`
- non piu esistente o handle invalido

Al completamento o fallimento viene inviata una notifica all'utente.

## Modello Dati

### `process_executions`

Registro locale delle esecuzioni avviate dagli utenti.

Campi principali:

- `id`
- `user_id`
- `process_id`
- `process_title`
- `process_version`
- `execution_mode`
- `remote_job_id`
- `status`
- `progress`
- `message`
- `request_payload`
- `requested_outputs`
- `remote_created_at`
- `remote_started_at`
- `remote_finished_at`
- `last_polled_at`
- `submitted_at`
- `completed_at`
- `failed_at`
- timestamps Laravel

Il payload originale deve essere sempre conservato localmente, perche il SaaS puo restituire `parameters: null`.

### `process_execution_results`

Risultati e metadati associati a un'esecuzione.

Campi principali:

- `id`
- `process_execution_id`
- `output_id`
- `title`
- `description`
- `media_type`
- `transmission_mode`
- `remote_href`
- `storage_path`
- `size_bytes`
- `cache_status`
- `preview`
- timestamps Laravel

### Catalogo Processi

Il catalogo remoto resta la sorgente primaria.
Per il primo rilascio usiamo cache applicativa per landing page, `/processes` e descrizioni dei processi.
Non introduciamo una tabella `process_definitions` finche non serve audit/versioning del catalogo.

## Strategia Risultati

Persistiamo sempre:

- esecuzione;
- payload originale;
- job ID remoto;
- stato;
- progress;
- messaggi;
- output richiesti;
- metadati risultati.

Per il contenuto risultati usiamo una strategia ibrida:

- JSON, CSV, testo e piccoli output: salvataggio locale e preview;
- output chart JSON: salvataggio e rendering grafico;
- binari pesanti, inclusi GeoTIFF: metadati e link remoto iniziali, cache locale on demand al download o alla preview;
- retention della cache binaria configurabile.

La preview mappa GeoTIFF e fase 2. Nel primo rilascio supportiamo download, metadati e cache on demand.

## Flussi Utente

### Navigazione Processi

1. L'utente autenticato apre la lista processi.
2. Laravel chiama il SaaS o legge dalla cache.
3. La UI mostra processi disponibili, descrizione, versioni, modalita job e output transmission supportate.

### Dettaglio Processo

1. L'utente apre un processo.
2. Laravel recupera `/processes/{processID}?f=json`.
3. `ProcessSchemaNormalizer` genera metadati form.
4. Inertia passa dati normalizzati alla pagina React.

### Esecuzione

1. L'utente compila il form dinamico.
2. Il frontend invia dati strutturati al backend.
3. `StartProcessExecution` salva record locale in stato `submitting`.
4. Laravel invia POST a `/processes/{processID}/execution`.
5. Risposta sync `200`: salva risultato e marca `successful`.
6. Risposta async `201`: salva `remote_job_id`, marca `accepted` o `running`, dispatcha polling.
7. Errore remoto o timeout: salva errore e marca `failed` o `submission_failed`.

### Dashboard Utente

La dashboard mostra:

- storico esecuzioni;
- stato job;
- progress;
- messaggi;
- processo e versione;
- payload originale;
- output richiesti;
- risultati disponibili;
- download e preview supportate.

## Frontend React/Inertia/shadcn

Le pagine vivono in `resources/js/pages`.
Il routing frontend usa Inertia e, quando collegato ai controller, Wayfinder.

Componenti React previsti:

- `ProcessListPage`
- `ProcessDetailPage`
- `DynamicProcessForm`
- `SchemaFieldRenderer`
- `OneOfField`
- `ArrayObjectField`
- `ArrayTableField`
- `OutputSelector`
- `ExecutionHistoryPage`
- `ExecutionDetailPage`
- `ResultPreview`

Per i form dinamici preferiamo `useForm`, perche serve controllo programmatico su oggetti annidati, array ripetibili, varianti `oneOf` e payload compositi.

I componenti UI devono usare shadcn/ui esistente o componenti aggiunti via registry quando necessario.
Componenti shadcn utili:

- `Button`
- `Input`
- `Select`
- `Checkbox`
- `ToggleGroup`
- `Card`
- `Badge`
- `Tabs`
- `Skeleton`
- `Alert`
- `Tooltip`
- `Table`
- `Progress`

Se vengono introdotti i componenti shadcn per form layout, usare `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription` e stati `aria-invalid`.

## Rendering Risultati

Il rendering si basa su media type e struttura dati:

- chart JSON con `chartType`, `domain`, `series`: grafico;
- `text/csv`: tabella e download;
- `text/plain`: viewer testo e download;
- `application/json`: viewer strutturato, con rilevamento chart quando applicabile;
- GeoTIFF e binari: metadati e download nell'MVP, preview mappa in fase 2.

## Error Handling

Stati locali previsti:

- `submitting`
- `accepted`
- `running`
- `successful`
- `failed`
- `submission_failed`
- `remote_missing`

Regole:

- timeout o connection error: conservare payload, registrare errore, mostrare retry possibile;
- job remoto 404: marcare `remote_missing`, mantenendo dashboard e payload locale;
- risultato non supportato: mostrare metadati e download invece di rompere la preview;
- errori di validazione: backend autorevole, frontend come aiuto UX.

## Sicurezza

- Solo utenti autenticati possono avviare ed esaminare esecuzioni.
- Ogni esecuzione appartiene a un utente.
- Policy o controlli controller impediscono accesso a esecuzioni altrui.
- La base URL del SaaS e configurata e allowlisted; il client non deve diventare proxy HTTP arbitrario.
- Upload file predisposto con limiti MIME e size.
- Storage privato per file utente e cache risultati.
- Evitare payload e response sensibili nei log applicativi.

## Testing

Test minimi previsti:

- unit test `OgcProcessesClient` con `Http::fake`;
- unit test `ProcessSchemaNormalizer` con fixture reali dei tre processi;
- feature test lista processi;
- feature test dettaglio processo;
- feature test submit esecuzione sync;
- feature test submit esecuzione async;
- feature test dashboard e autorizzazione;
- job test polling successful;
- job test polling failed;
- job test remote missing;
- test per cache selettiva risultati.

Per il frontend:

- typecheck TypeScript;
- copertura sui componenti dinamici dove utile;
- fixture JSON normalizzate per validare casi `oneOf`, array ripetibili e array tabellari.

## Fasi Di Implementazione

### Fase 1: Backend Core

- config SaaS;
- `OgcProcessesClient`;
- normalizzatore schema;
- migrations e model;
- azioni applicative;
- test backend.

### Fase 2: UI Processi Ed Esecuzione

- lista processi;
- dettaglio processo;
- form dinamico React/Inertia/shadcn;
- submit esecuzione;
- selezione output.

### Fase 3: Job Management

- dashboard storico;
- polling queue;
- notifiche;
- dettaglio esecuzione;
- gestione errori remoti.

### Fase 4: Risultati

- preview chart;
- preview tabella CSV;
- viewer testo/JSON;
- download;
- cache on demand binari.

### Fase 5: Preview Geospaziale

- valutazione GeoTIFF.js con Leaflet/OpenLayers oppure conversione server-side;
- mappa per GeoTIFF;
- eventuali layer e styling geospaziale.

## Fuori Scope MVP

- autenticazione verso il SaaS remoto;
- editing server-side dei processi;
- tabella persistente del catalogo remoto;
- preview mappa GeoTIFF completa;
- supporto completo a ogni keyword JSON Schema possibile;
- cancellazione/cancel remota dei job, salvo verifica successiva del supporto pygeoapi.

## Criteri Di Successo MVP

- L'utente autenticato vede i processi remoti reali.
- L'utente vede dettaglio input/output da JSON remoto.
- Il form dinamico supporta i casi reali di `solwcad`, `conduit`, `pybox`.
- L'utente avvia processi sync e async.
- Le esecuzioni sono salvate localmente con payload originale.
- La dashboard mostra storico, stato e progress.
- Il polling aggiorna job completati o falliti.
- JSON/chart, CSV e testo sono visualizzabili o scaricabili.
- GeoTIFF e binari sono scaricabili con metadati e cache on demand.
