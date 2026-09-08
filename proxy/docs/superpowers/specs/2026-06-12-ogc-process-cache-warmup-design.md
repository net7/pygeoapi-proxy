# OGC Process Cache Warm-Up Design

## Obiettivo

Popolare in background la cache del catalogo OGC e delle descrizioni dei processi quando l'applicazione viene avviata, senza aspettare che il primo utente apra `/processes`.

Il comportamento desiderato e:

- il boot dell'app dispatcha un warm-up asincrono;
- il warm-up carica sia `/processes` sia ogni `/processes/{id}`;
- le pagine processi leggono solo dalla cache;
- se la cache non e ancora pronta, l'utente vede uno stato di preparazione invece di attendere una chiamata remota;
- il TTL esistente resta invariato.

## Contesto Tecnico

Oggi `ProcessController` usa `Cache::remember()` direttamente nelle action `index()` e `show()`.
Questo rende lazy il caricamento del catalogo: il primo utente che visita `/processes` o `/processes/{process}` paga la chiamata HTTP verso pygeoapi.

Le chiavi attuali sono:

- `ogc-processes.catalog`
- `ogc-processes.process.{process}`

La configurazione esistente e in `config/services.php`:

- `services.ogc_processes.base_url`
- `services.ogc_processes.timeout`
- `services.ogc_processes.connect_timeout`
- `services.ogc_processes.cache_ttl`

L'applicazione usa cache database e queue database in locale. Lo stack Docker usa Horizon per `develop` e `staging`, gli unici ambienti previsti dai file di deploy. Il worker queue e considerato sempre attivo.

## Decisioni

### Trigger Del Warm-Up

Il trigger e il boot del runtime queue/Horizon.
Quando il worker viene avviato durante boot/deploy, l'applicazione dispatcha un job idempotente di warm-up.

Il dispatch deve essere protetto da un flag cache breve, per evitare duplicati quando partono piu processi o quando il worker viene riavviato piu volte in poco tempo.

Il dispatch non deve partire durante:

- test;
- comandi artisan non legati al runtime queue;
- operazioni di manutenzione come `migrate`, `route:list`, `config:cache`, `optimize`;
- esecuzione del job stesso.

Per questa iterazione non si implementa un fallback dal boot HTTP: il requisito deve dipendere dal worker sempre attivo, non dalla visita di una pagina.

### Job Di Warm-Up

Introdurre il job `WarmOgcProcessCacheJob`.

Il job deve:

1. acquisire un lock cache `ogc-processes.warmup.lock`;
2. chiamare `OgcProcessesClient::processes()`;
3. scrivere `ogc-processes.catalog` con `services.ogc_processes.cache_ttl`;
4. estrarre gli id dei processi dal catalogo;
5. chiamare `OgcProcessesClient::process($id)` per ogni id;
6. scrivere `ogc-processes.process.{id}` con lo stesso TTL;
7. rilasciare il lock.

Il job deve essere idempotente: se la cache e gia popolata puo comunque riscriverla, ma non deve creare effetti collaterali oltre alle chiavi cache.

### Servizio Di Cache

Estrarre la logica nel servizio applicativo `OgcProcessCache`.

Responsabilita del servizio:

- definire le chiavi cache;
- leggere catalogo e descrizioni dalla cache;
- scrivere catalogo e descrizioni nella cache;
- eseguire il warm-up completo;
- esporre uno stato leggibile dai controller quando la cache non e pronta.

Questo evita di duplicare chiavi e TTL tra controller e job.

## Data Flow

### Boot

1. Il runtime queue/Horizon avvia l'applicazione.
2. Un dispatcher di boot verifica che il contesto sia adatto.
3. Se non esiste un recente flag `ogc-processes.warmup.dispatched`, dispatcha `WarmOgcProcessCacheJob`.
4. Il job viene preso dal worker e popola la cache.

### Lista Processi

1. L'utente autenticato apre `/processes`.
2. Il controller legge `ogc-processes.catalog`.
3. Se la cache esiste, passa a Inertia i processi.
4. Se la cache manca, passa `processes: []` e `catalogStatus: warming`.
5. Il controller non chiama pygeoapi.

### Dettaglio Processo

1. L'utente autenticato apre `/processes/{process}`.
2. Il controller legge `ogc-processes.process.{process}`.
3. Se la cache esiste, normalizza la descrizione e renderizza il form.
4. Se la cache manca, passa `process: null`, `formSchema: null` e `processStatus: warming`.
5. Il controller non chiama pygeoapi.

## Error Handling

Se pygeoapi fallisce durante il warm-up, il job deve fallire e risultare visibile in Horizon/failed jobs.

Il fallimento non blocca il boot dell'app e non deve riattivare chiamate remote dalle request utente.
Finche la cache non viene popolata, le pagine mostrano lo stato di preparazione.

Il logging deve distinguere:

- fallimento del catalogo;
- fallimento di un singolo processo;
- numero di processi caricati prima del fallimento;
- base URL configurata.

Il client HTTP mantiene i retry brevi gia esistenti.
Il job usa 3 tentativi con backoff progressivo.

Un warm-up parziale non deve essere trattato come completato: se un dettaglio processo fallisce, il job fallisce.

## UI

La UI non deve mostrare una pagina vuota senza spiegazione.

Per `/processes`, quando `catalogStatus` e `warming`, mostrare un messaggio operativo breve: il catalogo dei servizi e in preparazione.

Per `/processes/{process}`, quando `processStatus` e `warming`, mostrare uno stato equivalente per il singolo processo e non renderizzare il form dinamico.

Non sono richiesti redirect.

## Test

Aggiungere o aggiornare test Pest per coprire:

- il servizio di cache scrive catalogo e dettagli usando `Http::fake()`;
- il job esegue il warm-up e rispetta il lock;
- `/processes` usa la cache quando presente;
- `/processes` non chiama pygeoapi quando la cache manca e mostra lo stato warming;
- `/processes/{process}` usa la cache quando presente;
- `/processes/{process}` non chiama pygeoapi quando la cache manca e mostra lo stato warming;
- il dispatch di boot accoda il job nel contesto queue/Horizon e non lo accoda nei contesti esclusi.

Le modifiche PHP devono essere formattate con Pint.

## Non Obiettivi

Non introduciamo in questa iterazione:

- refresh periodico dopo la scadenza del TTL;
- cache permanente senza scadenza;
- tabella database per versionare il catalogo;
- refresh manuale tramite comando artisan;
- chiamate remote fallback dalle pagine processi.

## Criteri Di Accettazione

- Avviando il runtime queue/Horizon viene dispatchato un warm-up asincrono.
- Il warm-up popola `ogc-processes.catalog`.
- Il warm-up popola `ogc-processes.process.{id}` per tutti i processi nel catalogo.
- La pagina `/processes` non fa chiamate remote quando la cache manca.
- La pagina `/processes/{process}` non fa chiamate remote quando la cache manca.
- Gli utenti vedono uno stato di preparazione se aprono le pagine prima del completamento del job.
- Il TTL resta quello configurato da `services.ogc_processes.cache_ttl`.
- I test automatizzati dimostrano sia il warm-up sia il comportamento cache-only dei controller.
