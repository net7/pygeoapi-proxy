# Guida al deploy

[English](DEPLOY.md) · [Panoramica del progetto](README.it.md)

## Panoramica

Sviluppo e staging usano lo stack applicativo Compose condiviso con Laravel,
GeoServer, MariaDB, Redis, Horizon, Scheduler e Reverb. Lo sviluppo aggiunge
Vite, phpMyAdmin e Mailpit.

Tutti i file, gli esempi e le guide di deploy di questo repository fanno
riferimento esclusivamente a `develop` e `staging`. Make supporta entrambi gli
ambienti;
`deploy-dev-staging.sh` automatizza soltanto lo staging tramite GitLab CI/CD o
invocazione manuale.

## Ambienti

Il Makefile supporta due ambienti isolati. L'ambiente predefinito è `develop`.

| Ambiente | Progetto Compose | Endpoint pubblicati | Utilizzo |
| --- | --- | --- | --- |
| `develop` | `pygeoapi-proxy-develop` | App `8088`, Reverb `8089`, Vite `5174`, GeoServer `8091`, phpMyAdmin `8090`, Mailpit `8026` | Sviluppo locale |
| `staging` | `pygeoapi-proxy-staging` | App `127.0.0.1:7070`, Reverb `127.0.0.1:7071` | Staging gestito da GitLab dietro Nginx host |

La forma normale dei comandi è:

```bash
make [develop|staging] <target>
```

Esempi:

```bash
make up
make staging logs SERVICE=laravel
```

È equivalente la forma con variabile esplicita:

```bash
make up ENV=staging
```

È supportata anche la forma `make -e staging up`.

I volumi nominati sono isolati tramite `COMPOSE_PROJECT_NAME`: database, Redis,
storage Laravel e dati GeoServer non si sovrappongono tra sviluppo e staging.

## Architettura e servizi

```text
Sviluppo / staging
  Laravel / Horizon / Scheduler / Reverb
        |          |          |
     MariaDB     Redis    GeoServer
        |
        +---- HTTPS ----> API OGC Processes remota
```

| Servizio | Responsabilità | Esposizione |
| --- | --- | --- |
| `laravel` | Applicazione HTTP di sviluppo/staging | Pubblicata localmente o sul loopback di staging |
| `horizon` | Worker Laravel per le code Redis | Interno |
| `scheduler` | `php artisan schedule:work` | Interno |
| `reverb` | Server WebSocket Laravel | Pubblicato localmente o sul loopback di staging |
| `mariadb` | Database applicativo | Interno |
| `redis` | Cache, sessioni, code e scaling di Reverb | Interno |
| `geoserver` | Pubblica gli output GeoTIFF/SLD come layer cartografici | Porta host `8091` solo in sviluppo |
| `vite` | Dev server frontend compilato con Bun | Solo sviluppo, porta host `5174` |
| `phpmyadmin` | Interfaccia di amministrazione MariaDB | Solo sviluppo, porta host `8090` |
| `mailpit` | SMTP locale e interfaccia per le email | Solo sviluppo, porta host `8026` |

Sviluppo e staging impostano per default `OGC_PROCESSES_BASE_URL` sul servizio
separato `https://voice.pi.ingv.it/geoinquire/`. Laravel raggiunge il GeoServer
del proprio ambiente su `http://geoserver:8080/geoserver` tramite una rete
Compose privata.

## Prerequisiti

- Git;
- Docker Engine con il plugin Docker Compose;
- GNU Make;
- il file di ambiente creato dal template versionato corrispondente.

L'account di deploy dello staging richiede inoltre Bash, Curl, `flock` e accesso
SSH al remote Git. L'endpoint pubblico di staging richiede Nginx e Certbot
sull'host.

Controllare gli strumenti richiesti:

```bash
git --version
docker --version
docker compose version
make --version
```

## Configurare un ambiente

Creare una sola volta il file di sviluppo o staging scelto:

```bash
make env
make staging env
```

I comandi copiano il template soltanto se il file di destinazione non esiste:

| Ambiente | Template | File locale |
| --- | --- | --- |
| Sviluppo | `.env.develop.example` | `.env.develop` |
| Staging | `.env.staging.example` | `.env.staging` |

I file di ambiente contengono segreti e non devono essere committati. Prima di
usare lo staging sostituire almeno:

- `APP_KEY`
- `APP_URL`
- `MARIADB_ROOT_PASSWORD`
- `MARIADB_PASSWORD`
- `REVERB_APP_KEY`
- `REVERB_APP_SECRET`
- `REVERB_HOST`
- `REVERB_SCHEME`

Configurare anche una `GEOSERVER_PASSWORD` non predefinita quando GeoServer è
abilitato e impostare il relativo URL pubblico se differisce dal default.
Configurare le credenziali SMTP quando `MAIL_MAILER` non è `log`.

Google e ORCID sono opzionali. Abilitarli soltanto con dati reali dei provider:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ORCID_CLIENT_ID`
- `ORCID_CLIENT_SECRET`
- `ORCID_REDIRECT_URI`

I template configurano la dipendenza OGC Processes esterna con:

```dotenv
OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
```

Sostituire il valore quando un ambiente usa un deploy remoto differente. Non
pubblicare le porte di database, Redis o GeoServer in staging, salvo una precisa
scelta infrastrutturale.

Negli ambienti gestiti dal server limitare i permessi:

```bash
chmod 600 .env.staging
```

Verificare la connettività remota dall'host di deploy:

```bash
OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
curl --fail --silent --show-error \
  "${OGC_PROCESSES_BASE_URL%/}/processes?f=json" > /dev/null
```

## Avviare lo stack

Validare la configurazione Compose di sviluppo o staging senza stampare i
segreti risolti:

```bash
make config-check
make staging config-check
```

Compilare e avviare:

```bash
make up
make staging up
```

`make up` crea dal template un file di sviluppo mancante. Revisionare il file di
staging prima dell'avvio.

Controllare stato e health check:

```bash
make ps
make staging deploy-status
```

## Runtime e build delle immagini

L'immagine Laravel di sviluppo/staging usa una build multistage:

- `serversideup/php:8.5-fpm-nginx` per dipendenze Composer e runtime;
- `oven/bun:latest` per installazione dipendenze e build frontend;
- `node:latest` per il runtime richiesto dallo shebang di Vite.

Bun resta il package manager e build runner. Node viene copiato nell'immagine
finale perché Vite possa usare il runtime atteso.

Compose usa inoltre:

- `docker.osgeo.org/geoserver:2.27.1`;
- `mariadb:latest`;
- `redis:alpine`;
- `phpmyadmin:latest` in sviluppo;
- `axllent/mailpit:latest` in sviluppo.

I tag `latest` e `alpine` sono floating: una nuova build può acquisire nuove
release upstream. Ogni variazione va revisionata e testata prima del deploy.

Il memory limit PHP predefinito è `2G`. OPcache è disabilitato con validazione
dei timestamp in sviluppo; è abilitato senza validazione dei timestamp in
staging.

Build delle immagini:

```bash
make build
make staging build
```

Il deploy staging usa log di build in formato plain e compila soltanto
l'immagine applicativa Laravel:

```bash
make staging deploy-build
```

## Sviluppo

Avviare lo stack completo:

```bash
make env
make up
```

URL locali predefiniti:

- applicazione: `http://localhost:8088`
- Reverb: `http://localhost:8089`
- Vite: `http://localhost:5174`
- GeoServer: `http://localhost:8091/geoserver`
- phpMyAdmin: `http://localhost:8090`
- Mailpit: `http://localhost:8026`

Il codice Laravel è montato da `proxy/`. Vite usa un volume Linux dedicato per
`node_modules`, evitando di riutilizzare nel container dipendenze native
installate su un host macOS.

Vite ascolta su `0.0.0.0:5173` nel container e pubblicizza
`http://localhost:5174` al browser. `0.0.0.0` è un indirizzo di bind, non un URL
da aprire.

Comandi utili:

```bash
make test
make pint
make logs SERVICE=laravel
```

## Staging

Il template staging vincola Laravel e Reverb al loopback:

```text
Laravel  127.0.0.1:7070
Reverb   127.0.0.1:7071
```

Nginx sull'host pubblica entrambi i servizi su:

```text
https://proxygeoapi.netseven.work
```

Il virtual host versionato parte da
`deploy/nginx/proxygeoapi.netseven.work.conf`. Seguire la
[guida Nginx e TLS](deploy/nginx/README.md) per installazione, Basic Auth,
bootstrap Certbot, proxy WebSocket e validazione del reload.

Il container Laravel esegue migrazioni isolate e forzate, crea il link storage
e rigenera le cache. Horizon, Scheduler e Reverb rigenerano le proprie cache ma
non eseguono migrazioni.

## CI/CD dello staging

La topologia è:

```text
GitLab runner -> SSH -> gitlab_deploy -> checkout stabile
              -> deploy-dev-staging.sh -> Docker Compose
```

Endpoint operativi correnti:

- checkout: `/docker-data/configuration/pygeoapi-proxy`
- URL pubblico: `https://proxygeoapi.netseven.work`
- endpoint SSH: `91.107.228.84:1024`
- fingerprint host key SSH:
  `SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI`
- porta loopback Laravel: `127.0.0.1:7070`
- porta loopback Reverb: `127.0.0.1:7071`

Le Merge Request verso `develop` o `staging` eseguono:

- `deployment-check`;
- `php-check`;
- `frontend-check`.

Un push su `staging` esegue gli stessi gate e poi `deploy:staging`. Il runner
non compila né pubblica immagini applicative: si collega al server ed esegue:

```bash
./deploy-dev-staging.sh staging <commit-sha>
```

Composer, Bun, Vite e le build Docker girano sul server. Il
`resource_group: staging` di GitLab serializza i job CI, mentre `flock` evita la
sovrapposizione con un deploy manuale.

La configurazione remota è stata verificata tramite API GitLab il 2026-07-26:
il progetto è
[`net7-main/ingv/pygeoapi-proxy`](https://gitlab.netseven.it/net7-main/ingv/pygeoapi-proxy)
(ID `737`), `develop` è il branch protetto predefinito e la pipeline push
staging riuscita osservata ha eseguito tutti e quattro i job obbligatori nel
flusso previsto `quality -> test -> deploy`. La
[pagina delle pipeline GitLab](https://gitlab.netseven.it/net7-main/ingv/pygeoapi-proxy/-/pipelines)
mostra lo stato corrente.

## Account di deploy

Lo staging usa l'account esistente `gitlab_deploy`. Verificarlo senza
modificarlo:

```bash
getent passwd gitlab_deploy
id gitlab_deploy
sudo -u gitlab_deploy sh -lc 'printf "home=%s\n" "$HOME"; id; command -v git docker make curl flock'
```

L'account deve appartenere ai gruppi `docker` e `www-data`. Non concedere sudo
senza password. La pipeline non crea l'account e non modifica
`authorized_keys`: l'installazione della chiave pubblica dedicata resta
un'operazione amministrativa sorvegliata.

## Prerequisiti server

Eseguire questi controlli con un account amministrativo:

```bash
sudo -u gitlab_deploy test -d /docker-data/configuration/pygeoapi-proxy/.git
sudo -u gitlab_deploy test -f /docker-data/configuration/pygeoapi-proxy/.env.staging
sudo -u gitlab_deploy sh -lc 'command -v git bash flock curl docker make'
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy remote -v
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy ls-remote --exit-code origin refs/heads/staging
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy status --short --untracked-files=no
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy check-ignore .env.staging
sudo -u gitlab_deploy stat -c '%a %U:%G %n' /docker-data/configuration/pygeoapi-proxy/.env.staging
sudo -u gitlab_deploy docker info
sudo -u gitlab_deploy docker compose version
sudo nginx -T 2>&1 | grep -E '127\.0\.0\.1:(7070|7071)'
```

Lo stato dei file tracciati deve essere vuoto prima del primo deploy. Lo script
sostituisce i file versionati ma non usa `git clean -fdx`, preservando file
ignorati necessari come `.env.staging`. `check-ignore` deve confermare che il
file env è ignorato. `.env.staging` deve appartenere a `gitlab_deploy` con modo
`0600`.

Il dump Nginx deve mostrare i proxy verso entrambe le porte loopback.

## Chiave SSH e known hosts

Usare una chiave Ed25519 dedicata al progetto. Da una directory temporanea
protetta su una workstation amministrativa:

```bash
DEPLOY_HOST=91.107.228.84
DEPLOY_PORT=1024
umask 077
ssh-keygen -q -t ed25519 -a 100 -N '' -C 'gitlab-pygeoapi-proxy-staging' -f ./pygeoapi-proxy-staging
ssh-copy-id -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging.pub "gitlab_deploy@$DEPLOY_HOST"
ssh-keyscan -H -p "$DEPLOY_PORT" -t ed25519 "$DEPLOY_HOST" > ./pygeoapi-proxy-staging.known_hosts
ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts
ssh -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging "gitlab_deploy@$DEPLOY_HOST" true
```

Leggere sul server la fingerprint autorevole:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Deve coincidere con:

```text
SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI
```

Verificarla tramite un canale amministrativo distinto prima di caricare
`known_hosts` in GitLab. Non disabilitare mai la verifica dell'host. Dopo aver
configurato GitLab, eliminare in modo sicuro le copie temporanee della chiave
privata.

## Variabili GitLab protette

Configurare in **Settings > CI/CD > Variables**:

| Variabile | Tipo | Protezione | Valore o scopo |
| --- | --- | --- | --- |
| `DEPLOY_SSH_KEY` | File | Protected; masked se supportato | Chiave privata dedicata |
| `DEPLOY_KNOWN_HOSTS` | File | Protected | Host key verificata su canale distinto |
| `DEPLOY_HOST` | Variable | Protected | Hostname o IP dello staging |
| `DEPLOY_PORT` | Variable | Protected | `1024` |
| `DEPLOY_USER` | Variable | Protected | `gitlab_deploy` |
| `DEPLOY_PATH` | Variable | Protected | `/docker-data/configuration/pygeoapi-proxy` |

Non copiare `.env.staging` nelle variabili GitLab: rimane soltanto sul server.

## Impostazioni progetto GitLab

1. Mantenere `staging` protetto.
2. Configurare **Allowed to merge** per i ruoli autorizzati.
3. Impostare **Allowed to push and merge > No one**, bloccando i push diretti
   senza impedire i merge autorizzati.
4. Abilitare **Pipelines must succeed**.
5. Su Premium o Ultimate, proteggere anche l'ambiente `staging` e limitarne il
   deploy ai ruoli autorizzati.

L'istanza attuale usa GitLab Community Edition e non offre ambienti protetti.
Il confine di sicurezza è quindi il branch `staging` protetto senza push
diretti, insieme alle variabili di deploy protette.

La regola branch verificata il 2026-07-26 imposta l'accesso push su **No one**,
l'accesso merge su **Developers + Maintainers** e disabilita il force-push per
`staging`. `develop`, `main` e `staging` sono tutti protetti.

Il workflow non viene eseguito per `main`.

## Bootstrap del primo deploy automatico

La pipeline prepara automaticamente il primo deploy, anche quando sul server
non esiste ancora `deploy-dev-staging.sh`. Il job `deployment-check` conserva
lo script verificato come artifact; `deploy:staging` lo invia via SSH ed esegue
il checkout dello SHA della pipeline. Dopo il successo dei quality gate,
la Merge Request da `develop` a `staging` può quindi essere unita direttamente.
Sul server devono già essere presenti il repository, `.env.staging` e gli
strumenti descritti nei prerequisiti.

### Alternativa per il bootstrap manuale

Per avviare il primo deploy senza la pipeline, installare lo script dall'esatto
head autenticato di `develop` prima del merge:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail

DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
TEMPORARY_SCRIPT=
BOOTSTRAP_INSTALLED=0

cleanup() {
    if [ -n "$TEMPORARY_SCRIPT" ]; then
        rm -f -- "$TEMPORARY_SCRIPT"
    fi
    if [ "$BOOTSTRAP_INSTALLED" -eq 1 ] &&
        ! git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy-dev-staging.sh \
            > /dev/null 2>&1
    then
        rm -f -- "$DEPLOY_PATH/deploy-dev-staging.sh"
    fi
}

trap cleanup EXIT

git -C "$DEPLOY_PATH" fetch origin --tags --prune
SOURCE_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/develop^{commit}')
STAGING_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/staging^{commit}')
CURRENT_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'HEAD^{commit}')

[ "$CURRENT_SHA" = "$STAGING_SHA" ] || {
    printf 'HEAD does not match origin/staging\n' >&2
    exit 1
}

[ -z "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=no)" ] || {
    printf 'The checkout contains changes to tracked files\n' >&2
    exit 1
}

git -C "$DEPLOY_PATH" check-ignore -q .env.staging
[ "$(stat -c '%a %U:%G' "$DEPLOY_PATH/.env.staging")" = \
    '600 gitlab_deploy:gitlab_deploy' ] || {
    printf '.env.staging has unexpected owner or permissions\n' >&2
    exit 1
}

if git -C "$DEPLOY_PATH" cat-file -e 'HEAD:deploy-dev-staging.sh' 2>/dev/null; then
    printf 'deploy-dev-staging.sh is already tracked by the current commit\n' >&2
    exit 1
fi

[ ! -e "$DEPLOY_PATH/deploy-dev-staging.sh" ] || {
    printf 'deploy-dev-staging.sh already exists in the working tree\n' >&2
    exit 1
}

TEMPORARY_SCRIPT=$(mktemp "$DEPLOY_PATH/.deploy-dev-staging.sh.bootstrap.XXXXXX")
git -C "$DEPLOY_PATH" show "${SOURCE_SHA}:deploy-dev-staging.sh" > "$TEMPORARY_SCRIPT"

EXPECTED_BLOB=$(git -C "$DEPLOY_PATH" rev-parse "${SOURCE_SHA}:deploy-dev-staging.sh")
ACTUAL_BLOB=$(git -C "$DEPLOY_PATH" hash-object "$TEMPORARY_SCRIPT")
[ "$ACTUAL_BLOB" = "$EXPECTED_BLOB" ] || {
    printf 'Unexpected bootstrap blob\n' >&2
    exit 1
}

bash -n "$TEMPORARY_SCRIPT"
chmod 0755 "$TEMPORARY_SCRIPT"
mv -- "$TEMPORARY_SCRIPT" "$DEPLOY_PATH/deploy-dev-staging.sh"
TEMPORARY_SCRIPT=
BOOTSTRAP_INSTALLED=1

VISIBLE_STATUS=$(
    git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all
)
[ "$VISIBLE_STATUS" = '?? deploy-dev-staging.sh' ] || {
    printf 'Unexpected working tree status:\n%s\n' "$VISIBLE_STATUS" >&2
    exit 1
}

[ "$(git -C "$DEPLOY_PATH" hash-object "$DEPLOY_PATH/deploy-dev-staging.sh")" = \
    "$EXPECTED_BLOB" ]
stat -c '%a %U:%G %n' "$DEPLOY_PATH/deploy-dev-staging.sh"
printf 'BOOTSTRAP_SOURCE_SHA=%s\n' "$SOURCE_SHA"
printf 'BOOTSTRAP_BLOB_SHA=%s\n' "$EXPECTED_BLOB"
printf '%s\n' "$VISIBLE_STATUS"

trap - EXIT
BASH
```

`BOOTSTRAP_SOURCE_SHA` deve coincidere con lo SHA sorgente della Merge Request
e con `refs/heads/develop` immediatamente prima del merge. In caso contrario,
non fare merge.

Rimuovere esclusivamente un bootstrap non tracciato:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail
DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
if git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy-dev-staging.sh \
    > /dev/null 2>&1
then
    printf 'deploy-dev-staging.sh is tracked; refusing removal\n' >&2
    exit 1
fi
[ "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all)" = \
    '?? deploy-dev-staging.sh' ]
rm -- "$DEPLOY_PATH/deploy-dev-staging.sh"
BASH
```

Il bootstrap non cambia `HEAD`, non avvia container e non legge il contenuto di
`.env.staging`. Il primo job automatico lo sostituisce con il file tracciato del
merge commit tramite `git checkout -f`.

## Verifica del primo deploy automatico

Dopo il successo della pipeline push di staging e del job `deploy:staging`:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail
DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
git -C "$DEPLOY_PATH" fetch origin --tags --prune
HEAD_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'HEAD^{commit}')
STAGING_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/staging^{commit}')
[ "$HEAD_SHA" = "$STAGING_SHA" ]
git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy-dev-staging.sh > /dev/null
[ -z "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all)" ]
git -C "$DEPLOY_PATH" check-ignore -q .env.staging
[ "$(stat -c '%a %U:%G' "$DEPLOY_PATH/.env.staging")" = \
    '600 gitlab_deploy:gitlab_deploy' ]
make -C "$DEPLOY_PATH" --no-print-directory ENV=staging deploy-status
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
printf 'DEPLOYED_SHA=%s\n' "$HEAD_SHA"
BASH
bash <<'BASH'
set -Eeuo pipefail
read -r -s -p 'Staging Basic Auth (user:password): ' STAGING_BASIC_AUTH
printf '\n'
curl --fail --silent --show-error \
  --user "$STAGING_BASIC_AUTH" \
  https://proxygeoapi.netseven.work/up > /dev/null
unset STAGING_BASIC_AUTH
printf 'PUBLIC_HEALTH=OK\n'
BASH
```

`DEPLOYED_SHA` deve coincidere con `merge_commit_sha` della Merge Request e lo
SHA della pipeline push di staging. `deploy-dev-staging.sh` deve essere tracciato e il
working tree pulito. La Basic Auth viene inserita senza eco e resta solo nella
shell temporanea: non salvarla nel repository, nella cronologia o nelle
variabili del deploy.

## Deploy automatico

Ogni pipeline push riuscita su `staging` scarica lo script verificato dal job
`deployment-check` e passa `CI_COMMIT_SHA` a:

```bash
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && bash -s -- staging '$CI_COMMIT_SHA'" < deploy-dev-staging.sh
```

Sul server `deploy-dev-staging.sh`:

1. valida strumenti, Docker, `.env.staging` e lock del deploy;
2. aggiorna i riferimenti Git e verifica che lo SHA sia raggiungibile da
   `origin/staging` e contenga `deploy-dev-staging.sh`;
3. esegue checkout dello SHA esatto in modalità detached e riavvia lo script
   versionato;
4. valida Compose;
5. compila l'immagine Laravel;
6. ferma i worker, aggiorna Laravel con automazioni migration-safe, aggiorna
   gli altri servizi e verifica gli health check.

Se la build fallisce, i container precedenti restano attivi. Gli errori
successivi mostrano fase, comando, SHA, stato servizi e log recenti. Mostrano un
comando di rollback soltanto quando la revisione precedente contiene
`deploy-dev-staging.sh`.

## Deploy manuale e rollback

Dalla root del checkout stabile sul server:

```bash
./deploy-dev-staging.sh staging <sha-raggiungibile-da-origin-staging>
```

Lo script rifiuta revisioni che non siano antenate di `origin/staging` o che non
contengano `deploy-dev-staging.sh`. Questo controllo avviene prima del checkout,
quindi una vecchia revisione rifiutata lascia invariato il checkout corrente.

Il rollback ridistribuisce una revisione precedente compatibile che contiene
`deploy-dev-staging.sh`:

```bash
./deploy-dev-staging.sh staging <sha-commit-precedente>
```

> **Attenzione:** il rollback ricompila e ridistribuisce il codice, ma non
> annulla le migrazioni del database. Verificare la compatibilità dello schema
> ed eseguire un backup prima di procedere. Non esiste un rollback automatico.

## Operazioni ricorrenti

Questi target Make operano soltanto su sviluppo e staging. Mostrare i target
disponibili:

```bash
make help
```

Configurazione e build:

```bash
make config
make staging config-check
make build
make staging deploy-build
```

Ciclo di vita:

```bash
make up
make start
make stop
make restart
make down
make ps
```

`make start` non ricompila. `make down` rimuove container e rete Compose ma
mantiene i volumi nominati.

Log e shell:

```bash
make logs
make logs SERVICE=laravel
make staging logs SERVICE='laravel horizon scheduler reverb'
make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200
make shell
make artisan CMD="route:list"
```

Database e manutenzione:

```bash
make migrate
make seed
make fresh
make optimize
make clear
make horizon-status
```

`make fresh` esegue `migrate:fresh --seed` e distrugge le tabelle applicative:
usarlo soltanto quando la perdita dei dati è intenzionale.

Qualità in sviluppo:

```bash
make test
make pint
make composer CMD="show"
make bun-install
make bun-build
```

> **Pericolo:** `make destroy` esegue
> `docker compose down -v --remove-orphans` e rimuove i volumi dell'ambiente,
> compresi MariaDB, Redis, storage Laravel e dati GeoServer. Verificare `ENV`
> prima di eseguirlo.

## Backup del database

Creare un backup del database configurato:

```bash
make artisan CMD="db:backup backup"
```

I backup sono salvati con modo `0600` in:

```text
storage/app/private/database-backups
```

In staging `storage/` si trova nel volume `laravel-storage` dello stack
condiviso. Un volume non è un backup off-host: copiare i dump approvati su
storage esterno protetto secondo la retention policy.

Ripristino interattivo:

```bash
make artisan CMD="db:backup restore <filename>"
```

Saltare la conferma solo in una procedura controllata:

```bash
make artisan CMD="db:backup restore <filename> --force"
```

> **Attenzione:** il restore sostituisce il database corrente. Fermare o
> drenare i worker, verificare ambiente e dump, quindi conservare il database
> corrente prima di procedere.

## Health check e diagnostica

Controlli principali dello staging:

```bash
make staging deploy-status
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
make staging logs SERVICE='laravel horizon scheduler reverb'
make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200
make staging logs SERVICE=reverb LOG_FOLLOW= LOG_TAIL=200
ps -ef | grep '[d]eploy-dev-staging.sh staging'
```

L'health check pubblico è protetto da Basic Auth. Inserire le credenziali senza
scriverle direttamente nel comando:

```bash
read -r -s -p 'Staging Basic Auth (user:password): ' STAGING_BASIC_AUTH
printf '\n'
curl --fail --silent --show-error \
  --user "$STAGING_BASIC_AUTH" \
  https://proxygeoapi.netseven.work/up > /dev/null
unset STAGING_BASIC_AUTH
```

Validare Nginx prima del reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Risoluzione dei problemi

| Problema | Controllo | Azione |
| --- | --- | --- |
| Chiave SSH rifiutata | `ssh -vvv -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging "gitlab_deploy@$DEPLOY_HOST" true` | Verificare chiave pubblica in `~gitlab_deploy/.ssh/authorized_keys`, owner e permessi; ruotarla solo se necessario. |
| Host key errata | Confrontare `ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts` con la chiave host server | Verificare su un canale distinto, rigenerare `known_hosts` e aggiornare `DEPLOY_KNOWN_HOSTS`. |
| `.env.staging` assente | `sudo -u gitlab_deploy test -f /docker-data/configuration/pygeoapi-proxy/.env.staging` | Ripristinare il file approvato da secret store o backup; il deploy non lo crea. |
| Lock occupato | `ps -ef \| grep '[d]eploy-dev-staging.sh staging'` | Attendere il deploy attivo; rimuovere un lock stale solo dopo aver escluso processi attivi. |
| Build fallita | `make staging deploy-build` | Correggere il primo errore Composer, Bun/Vite o Docker e ridistribuire lo stesso SHA. |
| Migrazione fallita | Consultare i log Laravel con `LOG_FOLLOW=` | Correggere migrazione o connettività; verificare lo schema prima del rollback. |
| Laravel unhealthy | `make staging deploy-status` e Curl verso `127.0.0.1:7070/up` | Consultare log Laravel limitati, correggere e ridistribuire. |
| Reverb unhealthy | Controllare stato e log Reverb | Verificare Redis, chiavi Reverb, porta `7071` e location WebSocket Nginx. |
| API OGC remota non disponibile | Eseguire dall'host di deploy il controllo Curl documentato e consultare `make staging logs SERVICE='laravel horizon' LOG_FOLLOW= LOG_TAIL=200` | Verificare `OGC_PROCESSES_BASE_URL`, DNS, TLS, autenticazione upstream, timeout e disponibilità del servizio remoto. |
| Pubblicazione GeoServer fallita | Consultare log Laravel e GeoServer | Verificare credenziali, workspace, storage e URL REST interno. |

Durante la diagnostica non eseguire `docker image prune` globale o
`docker compose down -v` sul server condiviso.

## Note di sicurezza

- Tenere `.env.staging` fuori da Git con modo `0600`.
- Usare chiavi SSH dedicate e variabili GitLab protette.
- Verificare le host key SSH su un canale distinto; non usare
  `StrictHostKeyChecking=no`.
- Bloccare i push diretti a `staging` e richiedere pipeline riuscite.
- Mantenere privati MariaDB, Redis e GeoServer di sviluppo/staging.
- Trattare ogni API OGC Processes configurata come dipendenza gestita
  separatamente e conservare le eventuali credenziali fuori da Git.
- Sostituire i segreti di esempio e revisionare ogni default prima dell'uso.
- Trattare i dump come segreti e copiarli su storage off-host cifrato e ad
  accesso controllato.
- Revisionare i tag container floating prima delle build.
- Non includere credenziali Basic Auth, OAuth, SMTP, database, GeoServer o
  Reverb in documentazione, cronologia Git, comandi o log CI.

## Mappa dei file di deploy

| File | Scopo |
| --- | --- |
| `compose.yaml` | Servizi, reti, volumi e default comuni |
| `compose.develop.yaml` | Bind mount, porte, Vite, phpMyAdmin e Mailpit |
| `compose.staging.yaml` | Automazioni staging e storage Laravel persistente |
| `.env.develop.example`, `.env.staging.example` | Template versionati per Make |
| `Makefile` | Comandi operativi sviluppo/staging |
| `proxy/Dockerfile` | Runtime Laravel e build frontend multistage |
| `.gitlab-ci.yml` | Quality gate e deploy automatico staging |
| `deploy-dev-staging.sh` | Orchestratore versionato e serializzato solo per lo staging |
| `deploy/README.md` | Indice della documentazione di deploy |
| `deploy/nginx/README.md` | Runbook Nginx e TLS dell'host di staging |
| `deploy/nginx/proxygeoapi.netseven.work.conf` | Virtual host staging versionato |
| `deploy/tests/` | Test di contratto delle automazioni di deploy |
