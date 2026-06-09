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
  in `develop` e `${APP_PORT:-8080}` negli altri ambienti.
- `horizon`: worker code Laravel Horizon.
- `scheduler`: `php artisan schedule:work`.
- `reverb`: WebSocket server Laravel Reverb, pubblicato su
  `${REVERB_HOST_PORT:-8089}` in `develop` e `${REVERB_HOST_PORT:-8081}`
  negli altri ambienti.
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

Build immagini:

```bash
make build
make staging build
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

- Laravel APP_URL: `http://ingv.test`
- Laravel porta container diretta: `http://localhost:8088`
- Reverb: `http://ingv.test:8089`
- Vite: `http://ingv.test:5174`
- pygeoapi: `http://localhost:5000`
- phpMyAdmin: `http://localhost:8090`
- Mailpit: `http://localhost:8026`

In `staging` e `production`, Laravel e Reverb restano esposti sulle porte
configurate, mentre pygeoapi resta solo interno al network Docker.

## File principali

- `compose.yaml`: servizi comuni.
- `compose.develop.yaml`: override development, bind mount del codice,
  Vite/Bun e porta host pygeoapi.
- `compose.staging.yaml`: override staging.
- `compose.production.yaml`: override production.
- `proxy/Dockerfile`: immagine Laravel Server Side Up + build asset Bun.
- `Dockerfile`: immagine pygeoapi.
- `Makefile`: comandi rapidi.
- `.env.*.example`: template env per ambiente.

## Note operative

I volumi Docker sono isolati per ambiente tramite `COMPOSE_PROJECT_NAME` nei
file `.env.*`. Questo permette a `develop`, `staging` e `production` di avere
database e Redis separati anche se si usa la stessa porta host quando un solo
ambiente e' attivo alla volta.

Le automazioni Server Side Up sono disabilitate in `develop` e abilitate sul
servizio web in `staging` e `production`. Horizon, Scheduler e Reverb restano
processi separati e non eseguono migrazioni automatiche.

Il servizio Vite in `develop` usa la stessa immagine Laravel, con PHP e Bun
disponibili. Questo serve per Wayfinder, che genera tipi chiamando
`php artisan`. Il codice locale e' montato in bind mount, mentre `node_modules`
usa un volume Docker dedicato per evitare di riusare dipendenze native installate
sull'host macOS dentro il container Linux.

Vite ascolta dentro il container su `0.0.0.0:5173`, ma pubblica gli URL browser
con `VITE_DEV_SERVER_URL=http://ingv.test:5174`. Non usare `0.0.0.0` come URL
nel browser: e' solo un indirizzo di bind del processo.

Quando cambiano servizi Compose, porte, variabili `.env.*.example`, comandi
Make o workflow operativi, aggiorna questo README nello stesso commit.
