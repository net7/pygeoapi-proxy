```
                                              _                               
    ____  __  ______ ____  ____  ____ _____  (_)  ____  _________  _  ____  __
   / __ \/ / / / __ `/ _ \/ __ \/ __ `/ __ \/ /  / __ \/ ___/ __ \| |/_/ / / /
  / /_/ / /_/ / /_/ /  __/ /_/ / /_/ / /_/ / /  / /_/ / /  / /_/ />  </ /_/ / 
 / .___/\__, /\__, /\___/\____/\__,_/ .___/_/  / .___/_/   \____/_/|_|\__, /  
/_/    /____//____/                /_/        /_/                    /____/   
```

Configurazione Docker Compose unica per eseguire Laravel, pygeoapi, MariaDB,
Redis, Horizon, Scheduler, Reverb e Vite/Bun.

## Ambienti

Gli ambienti supportati sono:

- `develop`
- `staging`
- `production`

Se non specifichi un ambiente, il default e' `develop`.

Il comando consigliato e':

```bash
make up
```

Per usare un ambiente diverso:

```bash
make staging up
make production up
```

E' supportato anche lo stile richiesto con `-e`:

```bash
make -e staging up
make -e production up
```

In alternativa puoi usare la variabile esplicita:

```bash
make up ENV=staging
make up ENV=production
```

## Servizi

- `laravel`: applicazione Laravel pubblica sulla porta host `${APP_PORT:-8088}`
  in `develop`, su `127.0.0.1:7070` in `staging` e su `${APP_PORT:-8080}` in
  `production`.
- `horizon`: worker code Laravel Horizon.
- `scheduler`: `php artisan schedule:work`.
- `reverb`: WebSocket server Laravel Reverb, pubblicato su
  `${REVERB_HOST_PORT:-8089}` in `develop`, su `127.0.0.1:7071` in `staging`
  e su `${REVERB_HOST_PORT:-8081}` in `production`.
- `mariadb`: database interno al network Compose.
- `redis`: cache, sessioni e code Laravel.
- `pygeoapi`: servizio pygeoapi interno al network Compose.
- `vite`: solo in `develop`, dev server Vite eseguito con Bun.
- `phpmyadmin`: solo in `develop`, gia' configurato verso MariaDB.
- `mailpit`: solo in `develop`, SMTP locale e interfaccia web per testare le
  email.

In `develop`, pygeoapi e' esposto anche sull'host:

```text
http://localhost:5000
```

In `develop`, phpMyAdmin e' esposto su:

```text
http://localhost:8090
```

In `develop`, Mailpit e' esposto su:

```text
http://localhost:8026
```

In `staging` e `production`, pygeoapi non e' pubblicato sull'host: Laravel lo
raggiunge internamente con:

```text
PYGEOAPI_BASE_URL=http://pygeoapi
```

## Runtime

Laravel usa un'immagine applicativa custom basata su:

```text
serversideup/php:8.5-fpm-nginx
```

Gli asset frontend sono installati e compilati con Bun:

```text
oven/bun:latest
```

L'immagine Laravel copia anche il binario Node dall'immagine ufficiale:

```text
node:latest
```

Questo mantiene Bun come package manager/build runner, ma permette a Vite di
eseguire il proprio binario `#!/usr/bin/env node` con il runtime previsto.

pygeoapi resta basato sul Dockerfile root, che estende:

```text
geopython/pygeoapi:latest
```

MariaDB e Redis usano immagini floating latest/alpine:

```text
mariadb:latest
redis:alpine
```

Le impostazioni PHP sono gestite via variabili Server Side Up, quindi non serve
modificare manualmente un `php.ini`. Il limite memoria predefinito e' `2G` in
tutti gli ambienti. In `develop` OPcache resta disabilitato; in `staging` e
`production` e' abilitato con timestamp validation disattivata.

## Prima configurazione

Crea il file env dell'ambiente partendo dall'esempio:

```bash
make env
make staging env
make production env
```

Questo crea, se mancante:

- `.env.develop`
- `.env.staging`
- `.env.production`

Prima di usare `staging` o `production`, modifica almeno:

- `APP_KEY`
- `APP_URL`
- `MARIADB_ROOT_PASSWORD`
- `MARIADB_PASSWORD`
- `REVERB_APP_KEY`
- `REVERB_APP_SECRET`
- `REVERB_HOST`
- `REVERB_SCHEME`

Il template `staging` preconfigura inoltre `HOST_BIND_ADDRESS=127.0.0.1`,
`APP_PORT=7070`, `REVERB_HOST_PORT=7071` e `REVERB_PORT=443` per l'Nginx host.
Questi valori non sono i default di `develop` o `production`.

## CI/CD staging

Le Merge Request verso `develop` e `staging` eseguono i controlli PHP,
frontend e Docker Compose. Un merge riuscito su `staging` avvia inoltre il
deploy automatico su `https://proxygeoapi.netseven.work`.

Il job GitLab si collega via SSH con l'utente `gitlab_deploy` e invoca nel
checkout stabile:

```bash
./deploy.sh staging <commit-sha>
```

Il server conserva `.env.staging`, costruisce le immagini, esegue le migrazioni
Laravel `--force --isolated`, rigenera le cache e verifica gli health check.
Le immagini applicative non vengono pubblicate nel Container Registry.

La configurazione GitLab, il bootstrap del server, il rollback e il
troubleshooting sono descritti in `deploy/README.md`.

## Comandi rapidi

Mostra l'aiuto:

```bash
make help
```

Render della configurazione Compose finale:

```bash
make config
make staging config
make production config
```

Validazione Compose senza stampare la configurazione risolta:

```bash
make staging config-check
```

Build immagini:

```bash
make build
make staging build
```

Build e aggiornamento ordinato dello staging:

```bash
make staging deploy-build
make staging deploy-up
make staging deploy-status
```

Avvio stack:

```bash
make up
make staging up
make production up
```

Avvio senza rebuild:

```bash
make start
```

Stop dei container:

```bash
make stop
```

Stop e rimozione container/network:

```bash
make down
```

Rimozione anche dei volumi dati dell'ambiente corrente:

```bash
make destroy
make production destroy
```

Stato container:

```bash
make ps
```

Log di tutti i servizi:

```bash
make logs
```

Log di un servizio specifico:

```bash
make logs SERVICE=laravel
make logs SERVICE=pygeoapi
make staging logs SERVICE=horizon
```

Shell nel container Laravel:

```bash
make shell
```

Esecuzione Artisan:

```bash
make artisan CMD="route:list"
make artisan CMD="config:show database.default"
```

Migrazioni:

```bash
make migrate
```

Reset database con seed:

```bash
make fresh
```

Seeder:

```bash
make seed
```

Test Laravel:

```bash
make test
```

Formatter PHP:

```bash
make pint
```

Comandi Composer nel container Laravel:

```bash
make composer CMD="show"
```

Install frontend dependencies con Bun, sul filesystem locale:

```bash
make bun-install
```

Build asset frontend con Bun, sul filesystem locale:

```bash
make bun-build
```

Cache Laravel:

```bash
make optimize
make clear
```

Stato Horizon:

```bash
make horizon-status
```

Validazione configurazione pygeoapi:

```bash
make pygeoapi-validate
```

## URL locali

Con i valori di default in `develop`:

- Laravel APP_URL: `http://localhost:8088`
- Laravel porta container diretta: `http://localhost:8088`
- Reverb: `http://localhost:8089`
- Vite: `http://localhost:5174`
- pygeoapi: `http://localhost:5000`
- phpMyAdmin: `http://localhost:8090`
- Mailpit: `http://localhost:8026`

In `staging`, Laravel e Reverb sono raggiungibili soltanto dall'host su
`127.0.0.1:7070` e `127.0.0.1:7071`; l'Nginx host pubblica applicazione e
WebSocket sul dominio `proxygeoapi.netseven.work`. In `production` le porte
restano configurabili normalmente. Pygeoapi resta interno al network Docker.
La procedura staging completa è in `deploy/nginx/README.md`.

## File principali

- `compose.yaml`: servizi comuni.
- `compose.develop.yaml`: override development, bind mount del codice,
  Vite/Bun e porta host pygeoapi.
- `compose.staging.yaml`: override staging.
- `compose.production.yaml`: override production.
- `proxy/Dockerfile`: immagine Laravel Server Side Up + build asset Bun.
- `Dockerfile`: immagine pygeoapi.
- `Makefile`: comandi rapidi.
- `.gitlab-ci.yml`: quality gate e deploy automatico dello staging.
- `deploy.sh`: orchestrazione versionata eseguita sul server staging.
- `deploy/README.md`: bootstrap GitLab/server, rollback e troubleshooting.
- `.env.*.example`: template env per ambiente.
- `deploy/nginx/proxygeoapi.netseven.work.conf`: vhost HTTP iniziale staging.
- `deploy/nginx/README.md`: installazione Nginx e bootstrap Certbot.

## Note operative

I volumi Docker sono isolati per ambiente tramite `COMPOSE_PROJECT_NAME` nei
file `.env.*`. Questo permette a `develop`, `staging` e `production` di avere
database e Redis separati anche se si usa la stessa porta host quando un solo
ambiente e' attivo alla volta.

Le automazioni Server Side Up sono disabilitate in `develop`. In `staging`, il
servizio Laravel esegue migrazioni isolate e forzate, crea il link storage e
rigenera le cache; Horizon, Scheduler e Reverb rigenerano le proprie cache ma
non eseguono migrazioni. In `production` resta valida la configurazione
specifica già presente, indipendente dalla pipeline staging.

Il servizio Vite in `develop` usa la stessa immagine Laravel, con PHP e Bun
disponibili. Questo serve per Wayfinder, che genera tipi chiamando
`php artisan`. Il codice locale e' montato in bind mount, mentre `node_modules`
usa un volume Docker dedicato per evitare di riusare dipendenze native installate
sull'host macOS dentro il container Linux.

Vite ascolta dentro il container su `0.0.0.0:5173`, ma pubblica gli URL browser
con `VITE_DEV_SERVER_URL=http://localhost:5174`. Non usare `0.0.0.0` come URL
nel browser: e' solo un indirizzo di bind del processo.

Quando cambiano servizi Compose, porte, variabili `.env.*.example`, comandi
Make o workflow operativi, aggiorna questo README nello stesso commit.
