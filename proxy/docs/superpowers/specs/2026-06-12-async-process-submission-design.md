# Async Process Submission Design

## Obiettivo

Rendere immediata la redirect dopo l'avvio di un processo OGC.

Oggi la request `POST /processes/{process}/jobs` resta bloccata finche Laravel completa la chiamata remota a `/processes/{processID}/execution`. Questo rende lenta o apparentemente bloccata la navigazione verso la pagina dettaglio del job.

Il comportamento desiderato e:

- la request web crea subito un job locale;
- l'utente viene reindirizzato immediatamente alla pagina dettaglio del job;
- la submission remota verso pygeoapi avviene in coda;
- la pagina dettaglio mostra inizialmente lo stato `submitting`;
- il polling esistente continua ad aggiornare la pagina quando la submission remota produce un job remoto;
- la redirect include un toast di conferma con le informazioni principali del processo avviato.

## Contesto Tecnico

Il flusso attuale passa da `ProcessExecutionController::store()` a `StartProcessExecution::handle()`.
L'azione crea un `ProcessExecution`, chiama subito `OgcProcessesClient::execute()`, poi aggiorna il record in base alla risposta.

La pagina dettaglio esiste gia in `resources/js/pages/process-executions/show.tsx` e supporta:

- stato `submitting`;
- ID locale quando manca `remote_job_id`;
- progress;
- polling Inertia;
- visualizzazione messaggio di stato;
- risultati salvati.

Il progetto usa queue database in locale e Horizon in produzione.
Il worker queue e considerato parte del runtime applicativo.

Le descrizioni dei processi sono gia preriscaldate in cache dal warm-up OGC.
La request web di avvio job deve leggere la descrizione dalla cache e non deve usare fallback remoto verso pygeoapi.

La UI ha gia il meccanismo di flash toast tramite `Inertia::flash('toast', ...)` e il toaster Sonner.

## Decisioni

### Separazione Request Web E Submission Remota

Il controller non deve piu chiamare direttamente il servizio OGC remoto.

`ProcessExecutionController::store()` deve:

1. validare la request;
2. leggere la descrizione del processo dalla cache locale;
3. creare il `ProcessExecution` locale;
4. dispatchare un job di submission;
5. impostare un toast flash di conferma;
6. fare redirect a `jobs.show`.

La redirect deve avvenire prima della chiamata remota a `/execution`.
Se la descrizione processo manca dalla cache, la request deve fallire in modo esplicito senza tentare una chiamata remota.

### Conservare La Modalita OGC Scelta

La modifica rende asincrona la request web, non forza automaticamente la modalita remota.

Il valore scelto dall'utente nel form resta significativo:

- `sync` continua a inviare `Prefer: respond-sync` verso pygeoapi, ma lo fa dentro il job di coda;
- `async` continua a inviare `Prefer: respond-async` verso pygeoapi.

Questo evita regressioni con processi che supportano solo una delle due modalita OGC.

### Toast Di Conferma

Dopo la redirect alla pagina dettaglio, mostrare un toast flash.

Contenuto minimo:

- title: `Process queued`;
- message: conferma breve;
- description: nome processo, ID locale e modalita scelta.

Il toast non sostituisce lo stato della pagina dettaglio.
La pagina dettaglio resta la sorgente principale per stato, progress, remote job ID, messaggi e risultati.

Non introdurre una pagina intermedia e non aggiungere un alert persistente in questa iterazione.

## Componenti

### Creazione Locale

Introdurre o estrarre una responsabilita dedicata alla creazione locale del record, ad esempio `CreateProcessExecution`.

Responsabilita:

- creare `ProcessExecution` con stato `submitting`;
- impostare `progress` a `0`;
- salvare `user_id`, `process_id`, `process_title`, `process_version`;
- salvare `execution_mode`;
- salvare `request_payload`, redigendo valori inline grandi come oggi;
- salvare `requested_outputs`;
- salvare `process_outputs`;
- impostare `submitted_at`.

Questa parte non deve chiamare pygeoapi.

### Submission Remota

Estrarre la logica remota dall'attuale `StartProcessExecution` in una responsabilita dedicata, ad esempio `SubmitProcessExecution`.

Responsabilita:

- chiamare `OgcProcessesClient::execute()` con `process_id`, payload salvato e prefer header della modalita scelta;
- gestire risposta `201` aggiornando a `accepted`, progress `5` e `remote_job_id`;
- dispatchare `PollProcessExecutionJob` dopo risposta `201`;
- gestire risposta sync salvando i risultati e marcando il record `successful`;
- gestire errori di submission aggiornando a `submission_failed`.

### Job Di Submission

Introdurre `SubmitProcessExecutionJob`.

Responsabilita:

- ricevere l'ID del `ProcessExecution`;
- ricaricare il record;
- uscire se il record non esiste;
- uscire se il record e terminale;
- uscire se il record ha gia `remote_job_id`;
- chiamare `SubmitProcessExecution`;
- usare middleware `WithoutOverlapping("process-execution-submit-{id}")`;
- usare backoff breve per errori infrastrutturali non ancora salvati sul record.

Il job non deve conoscere request HTTP, Inertia o route.

### Controller

`ProcessExecutionController::store()` deve restare sottile.

Responsabilita:

- validare tramite `StoreProcessExecutionRequest`;
- recuperare l'utente autenticato;
- leggere la descrizione processo dalla cache locale;
- creare il record locale;
- dispatchare `SubmitProcessExecutionJob`;
- impostare il toast flash;
- redirect a `jobs.show`.

## Data Flow

### Submit Form

1. L'utente clicca `Execute`.
2. Inertia invia `POST /processes/{process}/jobs`.
3. Laravel valida `mode`, `inputs` e `outputs`.
4. Laravel legge la descrizione processo dalla cache.
5. Laravel crea `ProcessExecution` locale in stato `submitting`.
6. Laravel dispatcha `SubmitProcessExecutionJob`.
7. Laravel imposta il toast flash.
8. Laravel fa redirect a `jobs.show`.
9. L'utente vede subito la pagina dettaglio del job.

### Submission In Coda

1. Il worker esegue `SubmitProcessExecutionJob`.
2. Il job ricarica il record locale.
3. `SubmitProcessExecution` chiama pygeoapi `/processes/{processID}/execution`.
4. Se pygeoapi risponde `201`, il record diventa `accepted`, salva `remote_job_id` e dispatcha `PollProcessExecutionJob`.
5. Se pygeoapi risponde con risultato sync, il record diventa `successful` e i risultati vengono salvati.
6. Se pygeoapi fallisce, il record diventa `submission_failed`.

### Pagina Dettaglio

1. La pagina viene renderizzata subito con stato `submitting`.
2. Il polling Inertia esistente ricarica `execution` e `pollingInterval`.
3. Quando la submission remota completa, la pagina mostra lo stato aggiornato.
4. Quando il polling remoto completa, la pagina mostra risultati o messaggio di fallimento.

## Error Handling E Idempotenza

La submission remota deve evitare duplicati.

Regole:

- se il record non esiste, il job termina senza errore;
- se il record e terminale, il job termina senza errore;
- se il record ha gia `remote_job_id`, il job termina senza rilanciare la submission;
- in caso di `RequestException`, salvare `status = submission_failed`, `message` e `failed_at`;
- in caso di eccezione generica, salvare `status = submission_failed`, `message` e `failed_at`;
- non fare retry applicativi dopo avere marcato il record `submission_failed`;
- lasciare visibili eventuali errori di job in Horizon quando il job fallisce prima di poter aggiornare il record.

Queste regole privilegiano l'assenza di duplicati remoti rispetto al retry aggressivo.

## UI

La pagina processo resta invariata salvo il fatto che il submit torna prima.

La pagina dettaglio deve essere considerata lo stato autorevole:

- `submitting`: submission remota in corso;
- `accepted` o `running`: job remoto avviato o in esecuzione;
- `successful`: risultati disponibili;
- `submission_failed`, `failed`, `remote_missing`: errore visibile nel riepilogo.

Il toast flash deve usare il meccanismo esistente.
Non e necessario introdurre un nuovo componente UI.

## Test

Aggiungere o aggiornare test Pest per coprire:

- `POST /processes/{process}/jobs` crea un `ProcessExecution`;
- la POST dispatcha `SubmitProcessExecutionJob`;
- la POST redirecta subito a `jobs.show`;
- la POST imposta il toast flash;
- la POST non chiama direttamente l'endpoint remoto `/execution`;
- la POST non usa fallback remoto per recuperare la descrizione processo;
- la creazione locale salva processo, payload, outputs, definizioni output, modalita e stato `submitting`;
- la submission remota con risposta `201` aggiorna a `accepted`, salva `remote_job_id` e dispatcha `PollProcessExecutionJob`;
- la submission remota con risposta sync salva risultati e marca `successful`;
- errori HTTP marcano `submission_failed`;
- eccezioni generiche marcano `submission_failed`;
- il job di submission non rilancia la submission se il record e terminale o ha gia `remote_job_id`.

Eseguire almeno:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/PollProcessExecutionJobTest.php
```

Le modifiche PHP devono essere formattate con Pint.

## Non Obiettivi

Non introduciamo in questa iterazione:

- pagina intermedia di conferma;
- alert persistente nella pagina dettaglio;
- retry manuale da UI per submission fallite;
- cancellazione job;
- modifica del polling remoto esistente;
- rimozione della scelta `sync`/`async` dal form;
- nuovo sistema di notifiche realtime.

## Criteri Di Accettazione

- Dopo il submit del form, l'utente viene reindirizzato subito alla pagina dettaglio del job locale.
- La request web non aspetta la chiamata remota a pygeoapi `/execution`.
- La request web legge la descrizione processo dalla cache locale, senza fallback remoto.
- Il record locale viene creato in stato `submitting`.
- La submission remota viene eseguita da un job di coda.
- La modalita OGC scelta dall'utente viene conservata nella submission remota.
- Il toast flash conferma processo, ID locale e modalita.
- Una risposta OGC `201` salva `remote_job_id` e attiva il polling remoto.
- Una risposta sync salva i risultati e marca il job `successful`.
- Un errore di submission marca il job `submission_failed` e mostra il messaggio nella pagina dettaglio.
- I test automatizzati dimostrano che la POST non chiama direttamente il servizio remoto.
