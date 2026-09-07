# GitLab CI/CD staging design

## Obiettivo

Introdurre una pipeline GitLab CI/CD dedicata allo staging di
`pygeoapi-proxy`. La pipeline deve verificare le Merge Request verso
`develop` e `staging`, quindi distribuire automaticamente ogni merge riuscito
su `staging`.

Il deploy segue il modello già in uso per `AI/3p-italia-pgf`: GitLab usa un
runner generico per i controlli e apre una connessione SSH verso l'utente
`gitlab_deploy`; tutta la logica operativa vive in un `deploy.sh` versionato ed
eseguito nel checkout stabile sul server.

La produzione avrà un flusso differente e non deve comparire nella pipeline,
nello script o nelle nuove procedure operative.

## Contesto esistente

- Il repository GitLab è
  `https://gitlab.netseven.it/net7-main/ingv/pygeoapi-proxy`.
- Il branch predefinito è `develop`; `develop` e `staging` esistono e sono
  protetti.
- Il server staging ospita già l'utente `gitlab_deploy`, membro dei gruppi
  `docker` e `www-data`.
- Il checkout stabile è
  `/docker-data/configuration/pygeoapi-proxy`.
- Lo stack usa `compose.yaml` insieme a `compose.staging.yaml` e carica
  `.env.staging` tramite il Makefile.
- `.env.staging` è presente soltanto sul server, è ignorato da Git e resta la
  fonte dei segreti applicativi.
- Laravel, Horizon, Scheduler, Reverb, MariaDB, Redis, pygeoapi e GeoServer
  sono servizi Docker Compose.
- L'immagine Laravel viene costruita dal `proxy/Dockerfile`: lo stage Composer
  installa le dipendenze production e lo stage asset esegue Bun e Vite.
- Il servizio web staging ha già `AUTORUN_ENABLED=true` e usa le Laravel
  Automations di `serversideup/php`.
- Nginx espone Laravel e Reverb tramite
  `https://proxygeoapi.netseven.work`.
- Il GitLab Container Registry è abilitato, ma non verrà usato dal flusso
  staging scelto.

## Decisioni approvate

1. I merge su `staging` distribuiscono automaticamente lo staging.
2. I push diretti a `staging` devono essere vietati; l'arrivo di un commit sul
   branch è sempre il risultato di una Merge Request.
3. I controlli CI girano sulle Merge Request dirette a `develop` o `staging` e
   vengono ripetuti sul commit risultante in `staging`.
4. Un runner GitLab generico esegue CI e job SSH; non viene installato un runner
   sul server staging.
5. Il job GitLab è un trigger sottile. Il server esegue un `deploy.sh`
   versionato, analogo al progetto 3P.
6. Il server costruisce localmente le immagini. La pipeline non pubblica
   immagini nel Container Registry.
7. I segreti applicativi rimangono nell'attuale `.env.staging` sul server.
8. Una breve interruzione durante l'aggiornamento dei container è accettabile.
9. Makefile, Compose staging e README possono essere modificati per rendere il
   processo chiaro, ordinato e leggibile nei log.
10. L'impostazione GitLab di progetto `Pipelines must succeed` viene abilitata.
    Poiché non esiste ancora una pipeline per `main`, le Merge Request verso
    `main` restano intenzionalmente bloccate fino alla progettazione del flusso
    production.

## Ambito

### Incluso

- `.gitlab-ci.yml` per CI e deploy staging;
- `deploy.sh` eseguito sul server;
- target Makefile non interattivi per il deploy;
- configurazione esplicita delle automazioni Laravel nello staging;
- quality gate PHP e frontend;
- validazione di Compose e dello script shell;
- configurazione documentata di branch, ambiente e variabili GitLab;
- documentazione di bootstrap server, deploy manuale e rollback;
- health check e diagnostica di errore.

### Escluso

- qualsiasi job o comportamento production;
- modifica della configurazione di produzione, gestita separatamente;
- pubblicazione di immagini applicative nel Container Registry;
- installazione di un GitLab Runner sul server;
- esecuzione dei comandi di bootstrap sul server durante l'implementazione;
- rollback automatico del database;
- backup automatici del database;
- deploy blue/green o zero-downtime;
- pulizia Docker globale sul server condiviso;
- aggiornamento o pinning delle immagini base attualmente configurate.

## Architettura

```text
Merge Request -> runner GitLab generico -> quality gate
                                         |
merge su staging -> pipeline staging ----+
                                         |
                                         v
                                  deploy:staging
                                         |
                                        SSH
                                         |
                                         v
                               utente deploy sul server
                                         |
                                         v
                       checkout stabile -> ./deploy.sh
                                         |
                                         v
                        build e update Docker Compose
                                         |
                                         v
                           migrazioni, cache, health check
```

Il job GitLab non trasferisce sorgenti né artefatti. Passa allo script remoto
l'ambiente fisso `staging` e lo SHA esatto della pipeline. Lo SHA evita che un
deploy in coda distribuisca per errore un merge successivo.

## Creazione delle pipeline

`workflow:rules` deve creare una pipeline soltanto nei casi seguenti:

1. `CI_PIPELINE_SOURCE == merge_request_event` e target uguale a `develop`;
2. `CI_PIPELINE_SOURCE == merge_request_event` e target uguale a `staging`;
3. `CI_PIPELINE_SOURCE == push` e branch uguale a `staging`;
4. ogni altro caso termina con `when: never`.

Non vengono create pipeline per normali push su feature branch o su `develop`.
Il deploy non è presente nelle pipeline di Merge Request.

## Stage e job

La pipeline usa gli stage `quality`, `test` e `deploy`. I controlli possono
girare in parallelo quando non hanno dipendenze tra loro.

### `php-check`

Responsabilità:

- usare una runtime PHP compatibile con quella applicativa;
- installare le dipendenze Composer incluse quelle di sviluppo, rispettando
  `composer.lock`;
- eseguire Pint in modalità check;
- eseguire la suite Pest/PHPUnit con la configurazione SQLite in-memory già
  presente;
- fallire al primo controllo non superato.

Il job CI non riusa le dipendenze production dell'immagine di deploy: ha bisogno
dei pacchetti development per test e lint.

### `frontend-check`

Responsabilità:

- installare in modo deterministico con `bun ci`;
- eseguire ESLint con `bun run lint:check`;
- eseguire Prettier con `bun run format:check`;
- eseguire TypeScript con `bun run types:check`;
- eseguire i test frontend con `bun test`.

La runtime CI deve rendere disponibili sia Bun sia Node, coerentemente con lo
stage asset del Dockerfile applicativo.

### `deployment-check`

Responsabilità:

- validare la configurazione ottenuta da `compose.yaml` e
  `compose.staging.yaml` usando `.env.staging.example`;
- non stampare la configurazione Compose risolta;
- eseguire `bash -n deploy.sh`;
- eseguire ShellCheck su `deploy.sh`;
- verificare gli eventuali test shell già presenti sotto `deploy/tests`.

### `deploy:staging`

Il job esiste soltanto per un push su `staging` e dipende dal successo di tutti
i job precedenti. Usa un'immagine minimale con OpenSSH client e:

- `GIT_STRATEGY: none`;
- `environment.name: staging`;
- `environment.url: https://proxygeoapi.netseven.work`;
- `resource_group: staging`;
- `interruptible: false`.

Il comando remoto concettuale è:

```bash
cd "$DEPLOY_PATH" && ./deploy.sh staging "$CI_COMMIT_SHA"
```

Argomenti, host e path devono essere quotati in modo sicuro. Lo script valida
nuovamente ambiente e revisione sul server.

## Variabili GitLab

Il job di deploy richiede:

| Variabile | Tipo | Protezione | Scopo |
| --- | --- | --- | --- |
| `DEPLOY_SSH_KEY` | File | protected, masked se supportato | chiave privata dedicata al progetto |
| `DEPLOY_KNOWN_HOSTS` | File | protected | host key verificata del server |
| `DEPLOY_HOST` | Variable | protected | hostname o IP del server |
| `DEPLOY_USER` | Variable | protected | utente `gitlab_deploy` |
| `DEPLOY_PATH` | Variable | protected | `/docker-data/configuration/pygeoapi-proxy` |

Nessun valore di `.env.staging` viene duplicato in GitLab. Il job copia il file
`known_hosts` nella home temporanea, avvia `ssh-agent`, carica la chiave e non
disabilita mai la verifica dell'host SSH.

## Impostazioni GitLab richieste

- `staging` rimane un branch protetto.
- Il push diretto a `staging` viene impostato su `No one`.
- Il merge resta consentito ai ruoli autorizzati dal progetto.
- `Pipelines must succeed`, attualmente disabilitato, viene abilitato a livello
  di progetto.
- Le variabili di deploy sono disponibili soltanto ai branch protetti.
- L'ambiente `staging` viene protetto e può essere distribuito soltanto dai
  ruoli autorizzati.

La configurazione corrente consente ancora il push diretto a Developer e
Maintainer: la nuova procedura deve correggere questa impostazione, non limitarsi
a documentare la convenzione.

Il gate sulla pipeline è globale in GitLab. Dal momento che `workflow:rules`
non crea pipeline per Merge Request verso `main`, tali Merge Request non possono
essere completate. Questo blocco è intenzionale e impedisce modifiche al ramo
production prima che il relativo flusso venga progettato.

## Prerequisiti del server

La procedura operativa verifica e documenta:

- checkout stabile presente in `DEPLOY_PATH`;
- remote `origin` configurato e accessibile dall'utente `gitlab_deploy`;
- `.env.staging` presente, non versionato e leggibile soltanto dagli utenti
  necessari;
- utente `gitlab_deploy` autorizzato a usare Docker senza `sudo` interattivo;
- Docker Engine, Docker Compose v2, Git, Bash, `flock` e Curl disponibili;
- porte `127.0.0.1:7070` e `127.0.0.1:7071` coerenti con Nginx;
- chiave pubblica dedicata aggiunta all'utente `gitlab_deploy`;
- directory priva di modifiche manuali ai file versionati.

Il checkout è deployment-managed. `deploy.sh` può sostituire modifiche ai file
tracciati, ma non usa `git clean -fdx` e quindi non rimuove `.env.staging` o
altri file ignorati necessari al server.

## Contratto di `deploy.sh`

Uso automatico:

```bash
./deploy.sh staging <commit-sha>
```

Uso manuale e rollback:

```bash
./deploy.sh staging <commit-sha-precedente>
```

Lo script accetta esclusivamente l'ambiente `staging`. Non contiene alias,
branch o comandi production. La revisione deve esistere nel repository e deve
essere un commit raggiungibile da `origin/staging`; questo impedisce il deploy
accidentale di codice estraneo al ramo staging.

Lo script usa `set -Eeuo pipefail`, una trap di errore e un lock `flock`
dedicato allo stack. Il lock copre sia i deploy GitLab sia le esecuzioni
manuali, mentre `resource_group` serializza i job GitLab prima che raggiungano
il server.

## Sequenza del deploy sul server

### 1. Preflight

- valida numero e valore degli argomenti;
- verifica comandi richiesti, Docker daemon, checkout e `.env.staging`;
- acquisisce il lock senza attesa indefinita;
- registra timestamp, SHA corrente e SHA richiesto;
- verifica che non sia in corso un altro deploy.

### 2. Aggiornamento del checkout

- esegue `git fetch origin --tags --prune`;
- risolve e valida lo SHA;
- verifica che sia raggiungibile da `origin/staging`;
- allinea forzatamente il checkout al commit richiesto;
- preserva `.env.staging` e gli altri file ignorati;
- riesegue la versione di `deploy.sh` presente nel commit appena selezionato,
  usando un marker interno per evitare ricorsione.

### 3. Validazione configurazione

Esegue il target Make `config-check` con l'ambiente staging. La validazione usa
`docker compose config --quiet` o un equivalente che non stampi i valori
interpolati. Un `.env.staging` mancante causa errore: il deploy non crea mai un
file segreti copiando automaticamente il template example.

### 4. Build

Esegue `deploy-build`. La build avviene mentre il vecchio stack continua a
servire richieste.

Il `proxy/Dockerfile` resta la fonte della procedura applicativa:

- Composer esegue `install --no-dev --no-interaction --prefer-dist` con
  autoloader ottimizzato;
- gli script Composer necessari alla discovery vengono eseguiti nella fase di
  generazione dell'autoload;
- Bun esegue `bun ci` rispettando `bun.lock`;
- Vite compila gli asset con `bun run build`;
- l'immagine runtime contiene `vendor` e `public/build` generati.

Composer e Bun non vengono installati o eseguiti direttamente nel checkout
host. Il loro output è visibile nella sezione build dei log Docker.

### 5. Aggiornamento ordinato dei servizi

Il target `deploy-up` esegue un aggiornamento non interattivo e senza una
seconda build:

1. arresta con `SIGTERM` Horizon, Scheduler e Reverb, lasciando completare la
   chiusura entro un timeout dichiarato;
2. ricrea Laravel con la nuova immagine e attende che diventi healthy;
3. durante il bootstrap Laravel esegue migrazioni e ottimizzazioni;
4. ricrea e avvia Horizon, Scheduler e Reverb con la nuova immagine;
5. aggiorna gli altri servizi Compose necessari, rimuove gli orfani e attende
   gli health check.

Questo ordine evita che worker con codice vecchio elaborino job durante una
migrazione. La breve interruzione di web socket e processi asincroni è accettata
per lo staging.

### 6. Verifica

- esegue `deploy-status`;
- verifica che i servizi richiesti siano healthy o running;
- chiama `http://127.0.0.1:7070/up` dal server;
- verifica lo stato health di Reverb;
- stampa SHA distribuito, SHA precedente, durata e URL pubblico.

## Laravel Automations

`compose.staging.yaml` rende espliciti i comportamenti che oggi dipendono in
parte dai default di `serversideup/php`.

Per `laravel`:

- `AUTORUN_ENABLED=true`;
- migrazione abilitata;
- `--force` abilitato;
- `--isolated` abilitato;
- `storage:link` abilitato;
- `artisan optimize` abilitato.

Per Horizon, Scheduler e Reverb:

- `AUTORUN_ENABLED=true`;
- migrazione disabilitata;
- ottimizzazione abilitata;
- creazione del link storage disabilitata quando non necessaria.

Ogni processo persistente prepara quindi le cache nel proprio container prima
di avviare il comando applicativo. Non serve invocare `artisan reload` perché i
container di Horizon, Scheduler e Reverb vengono ricreati.

Non viene eseguito un `cache:clear` generale sullo store Redis. Le nuove
immagini non contengono cache Laravel obsolete e le automazioni rigenerano
configurazione, route, eventi e view. Evitare il clear generale preserva cache
applicative e dati temporanei non collegati al deploy.

## Modifiche al Makefile

I target correnti per lo sviluppo restano compatibili. Vengono aggiunti target
espliciti e non interattivi:

| Target | Responsabilità |
| --- | --- |
| `require-env` | fallisce se `.env.<env>` non esiste, senza crearlo |
| `config-check` | valida Compose senza stampare la configurazione risolta |
| `deploy-build` | costruisce le immagini con pull delle basi e log leggibili |
| `deploy-up` | aggiorna i servizi nell'ordine definito e attende gli health check |
| `deploy-status` | mostra lo stato finale senza seguire i log |

`deploy.sh` orchestra questi target e aggiunge titoli e contesto. Il Makefile
mantiene i comandi Compose come singola fonte, evitando di duplicare lunghe
invocazioni nello script.

## Formato dei log

I log devono essere utili sia in terminale sia nella pagina job GitLab:

- intestazione con applicazione, ambiente e SHA;
- fasi numerate, per esempio `[3/6] Build immagini`;
- timestamp e durata complessiva;
- indicatori coerenti per inizio, successo, avviso ed errore;
- colore soltanto quando supportato, con rispetto di `NO_COLOR`;
- nessuna stampa di `.env.staging`, configurazione Compose risolta, chiavi o
  variabili protette;
- riepilogo finale conciso.

La trap di errore stampa:

- fase, comando e numero di riga falliti;
- codice di uscita;
- SHA corrente, richiesto e precedente;
- `docker compose ps`;
- un numero limitato di righe recenti dei servizi coinvolti;
- comando di rollback suggerito.

## Errori e rollback

- Un errore CI impedisce l'apertura della connessione SSH.
- Un errore di fetch, validazione o build lascia attivi i container precedenti.
- Un errore durante migrazione, ricreazione o health check fallisce il job e
  può lasciare parte dello stack aggiornata; la diagnostica deve renderlo
  evidente.
- Non viene eseguito rollback automatico, perché una migrazione può non essere
  compatibile con il codice precedente.
- Il rollback manuale riesegue `deploy.sh` con lo SHA precedente e ricostruisce
  le immagini da quel commit.
- Il rollback del codice non esegue downgrade dello schema. Prima di usarlo
  l'operatore deve verificare la compatibilità delle migrazioni applicate.
- Lo script non usa `docker compose down -v`, non elimina volumi e non esegue
  prune globale sul server condiviso.

## File interessati dall'implementazione

- `.gitlab-ci.yml`: workflow, quality gate e trigger SSH;
- `deploy.sh`: orchestrazione server staging;
- `Makefile`: primitive non interattive del deploy;
- `compose.staging.yaml`: automazioni Laravel esplicite e ordine operativo;
- `README.md`: panoramica CI/CD e collegamento alla procedura;
- `deploy/README.md`: bootstrap, variabili GitLab, esecuzione, rollback e
  troubleshooting;
- eventuali test shell sotto `deploy/tests/`.

Non sono previste modifiche al codice applicativo Laravel o React.

## Verifica dell'implementazione

Prima dell'attivazione:

1. lint della configurazione con GitLab CI Lint;
2. `bash -n` e ShellCheck su `deploy.sh`;
3. test shell pertinenti;
4. validazione Compose con `.env.staging.example` e output silenzioso;
5. suite PHP completa;
6. lint, format check, type check e test frontend;
7. build locale delle immagini staging;
8. controllo che il diff non contenga `.env.staging`, chiavi o token;
9. `git diff --check`.

La prima attivazione sul server viene eseguita con una procedura sorvegliata:

1. preparazione chiave, checkout e `.env.staging`;
2. deploy manuale dello SHA corrente;
3. verifica dei log e degli endpoint;
4. merge controllato su `staging`;
5. confronto tra SHA pipeline e SHA sul server;
6. prova documentata di rollback verso uno SHA compatibile, se concordata
   operativamente.

## Criteri di accettazione

1. Una Merge Request verso `develop` o `staging` esegue i controlli ma non il
   deploy.
2. Un controllo fallito blocca tutte le fasi successive.
3. Un merge riuscito su `staging` genera un solo deploy serializzato.
4. Un push diretto a `staging` non è consentito dalle impostazioni GitLab.
5. Il job distribuisce esattamente `CI_COMMIT_SHA`.
6. Lo SHA del checkout server coincide con quello della pipeline.
7. I log mostrano chiaramente Composer, build Bun/Vite, migrazioni,
   ottimizzazioni e health check.
8. Laravel esegue le migrazioni una sola volta con `--force --isolated`.
9. Horizon, Scheduler e Reverb partono con la nuova immagine e senza eseguire
   migrazioni.
10. Tutti i container richiesti risultano healthy o running.
11. `http://127.0.0.1:7070/up` risponde con successo e l'URL pubblico è
    raggiungibile.
12. `.env.staging`, chiavi SSH, token e configurazione Compose risolta non
    compaiono nei log o nei file versionati.
13. Un errore produce diagnostica e istruzioni di rollback senza eliminare
    volumi.
14. README e procedura server descrivono tutti i prerequisiti e i comandi.
15. Non esiste alcun job production e i file production restano invariati.
16. Le Merge Request verso `main` restano bloccate dal gate di progetto fino
    all'introduzione della futura pipeline production.

## Riferimenti

- [GitLab workflow rules](https://docs.gitlab.com/ci/yaml/workflow/)
- [GitLab resource groups](https://docs.gitlab.com/ci/resource_groups/)
- [GitLab environments](https://docs.gitlab.com/ci/environments/)
- [Laravel 13 deployment](https://laravel.com/docs/13.x/deployment)
- [Laravel 13 isolated migrations](https://laravel.com/docs/13.x/migrations#isolating-migration-execution)
- [Server Side Up Laravel Automations](https://serversideup.net/open-source/docker-php/docs/framework-guides/laravel/automations)
