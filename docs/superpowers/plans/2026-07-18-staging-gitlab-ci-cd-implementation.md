# Staging GitLab CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere quality gate GitLab e deploy automatico dello staging tramite SSH e uno script versionato eseguito sul server.

**Architecture:** Le Merge Request verso `develop` e `staging` eseguono controlli PHP, frontend e infrastrutturali sul runner GitLab generico. Un push risultante da merge su `staging` esegue gli stessi controlli e, soltanto dopo il loro successo, usa SSH per invocare `deploy.sh` nel checkout stabile; lo script costruisce e aggiorna lo stack Docker Compose sul server usando l'attuale `.env.staging`.

**Tech Stack:** GitLab CI/CD, Bash, GNU Make, Docker Compose v2, Laravel 13, `serversideup/php`, Composer, Bun, Vite, Pest/PHPUnit, ShellCheck, OpenSSH.

## Global Constraints

- Il deploy automatico riguarda esclusivamente il branch e l'ambiente `staging`.
- Non aggiungere job, regole, comandi o alias production.
- Non modificare `.env.production.example` o `compose.production.yaml`.
- Non pubblicare immagini applicative nel GitLab Container Registry.
- Non installare un GitLab Runner sul server staging.
- `.env.staging` resta soltanto sul server e non deve comparire in Git, artefatti o log.
- Il checkout server resta `/docker-data/configuration/pygeoapi-proxy` e viene gestito dall'utente `gitlab_deploy`.
- Il job GitLab deve distribuire esattamente `CI_COMMIT_SHA`, non la punta corrente del branch al momento dell'esecuzione.
- Una breve interruzione durante la ricreazione dei container staging è accettabile.
- Migrazioni Laravel: una sola esecuzione, `--force --isolated`, sul servizio web.
- Horizon, Scheduler e Reverb devono ottimizzare Laravel ma non eseguire migrazioni.
- Non usare `StrictHostKeyChecking=no`, `docker compose down -v`, reset del database o prune Docker globale.
- I target Make esistenti per develop e production devono mantenere il comportamento corrente.
- `Pipelines must succeed` verrà abilitato a livello progetto; le Merge Request verso `main` resteranno intenzionalmente bloccate fino alla futura pipeline production.
- Seguire la spec approvata in `docs/superpowers/specs/2026-07-18-staging-gitlab-ci-cd-design.md`.

## File Structure

- Create `.gitlab-ci.yml`: workflow GitLab, quality gate e trigger SSH staging.
- Create `deploy.sh`: unica orchestrazione del deploy eseguita nel checkout server.
- Modify `Makefile`: primitive Docker Compose non interattive e riusabili dallo script.
- Modify `compose.staging.yaml`: automazioni Laravel esplicite per web e processi persistenti.
- Create `deploy/tests/makefile-deploy.sh`: regressione dei target Make senza richiedere un daemon Docker.
- Create `deploy/tests/compose-staging-automation.sh`: verifica della configurazione Laravel renderizzata da Compose.
- Create `deploy/tests/deploy-script.sh`: test end-to-end isolato di validazione, checkout SHA, sequenza e failure diagnostics.
- Create `deploy/tests/gitlab-ci.sh`: contratto strutturale della pipeline e assenza di production.
- Create `deploy/tests/run.sh`: entry point unico della suite shell/infrastruttura.
- Create `deploy/README.md`: procedura operativa di bootstrap, deploy, rollback e troubleshooting.
- Modify `README.md`: panoramica CI/CD, nuovi target e link alla procedura.

---

### Task 1: Primitive Makefile per il deploy

**Files:**
- Create: `deploy/tests/makefile-deploy.sh`
- Modify: `Makefile:1-127`

**Interfaces:**
- Consumes: `ENV`, `ENV_FILE`, `compose.yaml`, `compose.<env>.yaml` e il comando `docker compose` già usati dal Makefile.
- Produces: target `require-env`, `config-check`, `deploy-build`, `deploy-up`, `deploy-status`; variabili `DEPLOY_WAIT_TIMEOUT`, `DEPLOY_STOP_TIMEOUT`, `LOG_FOLLOW`, `LOG_TAIL` usate da `deploy.sh` e dai test successivi.

- [ ] **Step 1: Scrivere il test fallente dei target di deploy**

Creare `deploy/tests/makefile-deploy.sh` con questo contenuto:

```sh
#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM

fake_bin="$temporary_directory/bin"
docker_log="$temporary_directory/docker.log"
environment_file="$temporary_directory/staging.env"
mkdir -p "$fake_bin"

cat > "$fake_bin/docker" <<'SCRIPT'
#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$DOCKER_LOG"
SCRIPT
chmod +x "$fake_bin/docker"

cd "$repository_root"

if PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" require-env \
    > "$temporary_directory/missing-env.log" 2>&1
then
    printf 'require-env unexpectedly accepted a missing file\n' >&2
    exit 1
fi

grep -F "Missing required environment file: $environment_file" \
    "$temporary_directory/missing-env.log" > /dev/null

: > "$environment_file"

PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" config-check
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" deploy-build
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" \
    DEPLOY_STOP_TIMEOUT=45 DEPLOY_WAIT_TIMEOUT=90 deploy-up
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" deploy-status
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" \
    LOG_FOLLOW= LOG_TAIL=25 SERVICE='laravel horizon' logs

compose_prefix="compose --env-file $environment_file -f compose.yaml -f compose.staging.yaml"

for expected_command in \
    "$compose_prefix config --quiet" \
    "$compose_prefix build --pull" \
    "$compose_prefix stop -t 45 horizon scheduler reverb" \
    "$compose_prefix up -d --no-build --wait --wait-timeout 90 laravel" \
    "$compose_prefix up -d --no-build --remove-orphans --wait --wait-timeout 90" \
    "$compose_prefix ps" \
    "$compose_prefix logs --tail=25 laravel horizon"
do
    if ! grep -Fx "$expected_command" "$docker_log" > /dev/null; then
        printf 'Missing Docker invocation: %s\n' "$expected_command" >&2
        exit 1
    fi
done
```

- [ ] **Step 2: Rendere eseguibile il test e verificare che fallisca**

Run:

```bash
chmod +x deploy/tests/makefile-deploy.sh
deploy/tests/makefile-deploy.sh
```

Expected: FAIL; `make` segnala che `require-env` non esiste.

- [ ] **Step 3: Aggiungere variabili e target Make minimi**

Modificare `Makefile` applicando questa struttura, senza cambiare i target esistenti tranne `logs`, che mantiene `-f --tail=100` come default:

```make
SERVICE ?=
CMD ?=
DEPLOY_WAIT_TIMEOUT ?= 180
DEPLOY_STOP_TIMEOUT ?= 60
DEPLOY_BUILD_PROGRESS ?= plain
LOG_FOLLOW ?= -f
LOG_TAIL ?= 100

.PHONY: help develop staging production env require-env config config-check build deploy-build pull up start deploy-up stop down restart ps deploy-status logs shell artisan migrate fresh seed test pint composer bun-install bun-build optimize clear horizon-status pygeoapi-validate destroy
```

Aggiungere all'help, dopo `config` e `build`:

```make
	@printf '%s\n' '  config-check      Validate Compose without printing resolved values'
	@printf '%s\n' '  deploy-build      Build deployment images with plain progress logs'
	@printf '%s\n' '  deploy-up         Update staging services in migration-safe order'
	@printf '%s\n' '  deploy-status     Show final deployment service status'
```

Aggiungere o sostituire i target interessati con:

```make
require-env:
	@if [ ! -f "$(ENV_FILE)" ]; then printf 'Missing required environment file: %s\n' "$(ENV_FILE)" >&2; exit 1; fi

config-check: require-env
	$(COMPOSE) config --quiet

deploy-build: require-env
	BUILDKIT_PROGRESS=$(DEPLOY_BUILD_PROGRESS) $(COMPOSE) build --pull

deploy-up: require-env
	$(COMPOSE) stop -t $(DEPLOY_STOP_TIMEOUT) horizon scheduler reverb
	$(COMPOSE) up -d --no-build --wait --wait-timeout $(DEPLOY_WAIT_TIMEOUT) laravel
	$(COMPOSE) up -d --no-build --remove-orphans --wait --wait-timeout $(DEPLOY_WAIT_TIMEOUT)

deploy-status: require-env
	$(COMPOSE) ps

logs: env
	$(COMPOSE) logs $(LOG_FOLLOW) --tail=$(LOG_TAIL) $(SERVICE)
```

Non aggiungere `env` come prerequisito dei target `deploy-*`: sul server un file mancante deve produrre errore, non essere creato dal template.

- [ ] **Step 4: Eseguire il test Makefile e la validazione Compose**

Run:

```bash
deploy/tests/makefile-deploy.sh
make ENV=staging ENV_FILE=.env.staging.example config-check
make help
```

Expected:

- test shell PASS senza output di errore;
- `config-check` exit `0` senza stampare la configurazione risolta;
- help contenente i quattro target di deploy.

- [ ] **Step 5: Controllare e committare il task**

Run:

```bash
git diff --check
git add Makefile deploy/tests/makefile-deploy.sh
git commit -m "feat: add staging deployment make targets"
```

Expected: commit con soltanto Makefile e relativo test.

---

### Task 2: Automazioni Laravel esplicite nello staging

**Files:**
- Create: `deploy/tests/compose-staging-automation.sh`
- Modify: `compose.staging.yaml:1-48`

**Interfaces:**
- Consumes: variabili `AUTORUN_*` supportate da `serversideup/php` e merge Compose tra `compose.yaml` e `compose.staging.yaml`.
- Produces: web container che migra e ottimizza; Horizon, Scheduler e Reverb che ottimizzano senza migrare.

- [ ] **Step 1: Scrivere il test fallente della configurazione renderizzata**

Creare `deploy/tests/compose-staging-automation.sh`:

```sh
#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
rendered_config=$(mktemp)
trap 'rm -f "$rendered_config"' EXIT HUP INT TERM

cd "$repository_root"

docker compose \
    --env-file .env.staging.example \
    -f compose.yaml \
    -f compose.staging.yaml \
    config --format json > "$rendered_config"

jq -e '
    . as $config |
    $config.services.laravel.environment.AUTORUN_ENABLED == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_MIGRATION == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_MIGRATION_FORCE == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_MIGRATION_ISOLATION == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_OPTIMIZE == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_STORAGE_LINK == "true" and
    (["horizon", "scheduler", "reverb"] | all(. as $service |
        $config.services[$service].environment.AUTORUN_ENABLED == "true" and
        $config.services[$service].environment.AUTORUN_LARAVEL_MIGRATION == "false" and
        $config.services[$service].environment.AUTORUN_LARAVEL_OPTIMIZE == "true" and
        $config.services[$service].environment.AUTORUN_LARAVEL_STORAGE_LINK == "false"
    ))
' "$rendered_config" > /dev/null
```

- [ ] **Step 2: Rendere eseguibile il test e verificare il fallimento**

Run:

```bash
chmod +x deploy/tests/compose-staging-automation.sh
deploy/tests/compose-staging-automation.sh
```

Expected: FAIL perché i processi persistenti hanno ancora `AUTORUN_ENABLED=false` e le opzioni esplicite mancano.

- [ ] **Step 3: Rendere esplicite le automazioni nel Compose staging**

In `compose.staging.yaml`, mantenere OAuth, OPcache e volumi correnti. Aggiungere al servizio `laravel`:

```yaml
      AUTORUN_ENABLED: "true"
      AUTORUN_LARAVEL_MIGRATION: "true"
      AUTORUN_LARAVEL_MIGRATION_FORCE: "true"
      AUTORUN_LARAVEL_MIGRATION_ISOLATION: "true"
      AUTORUN_LARAVEL_OPTIMIZE: "true"
      AUTORUN_LARAVEL_STORAGE_LINK: "true"
```

Sostituire `AUTORUN_ENABLED: "false"` in `horizon`, `scheduler` e `reverb` con questo blocco identico per ciascun servizio:

```yaml
      AUTORUN_ENABLED: "true"
      AUTORUN_LARAVEL_MIGRATION: "false"
      AUTORUN_LARAVEL_OPTIMIZE: "true"
      AUTORUN_LARAVEL_STORAGE_LINK: "false"
```

Non abilitare migrazioni, seed, `fresh` o `refresh` sui tre processi persistenti.

- [ ] **Step 4: Verificare Compose e il test OAuth preesistente**

Run:

```bash
deploy/tests/compose-staging-automation.sh
deploy/tests/compose-oauth-env.sh
make ENV=staging ENV_FILE=.env.staging.example config-check
```

Expected: tutti i comandi exit `0`.

- [ ] **Step 5: Committare il task**

Run:

```bash
git diff --check
git add compose.staging.yaml deploy/tests/compose-staging-automation.sh
git commit -m "feat: configure staging Laravel automations"
```

---

### Task 3: Script di deploy eseguito sul server

**Files:**
- Create: `deploy/tests/deploy-script.sh`
- Create: `deploy.sh`
- Uses: `Makefile` targets from Task 1

**Interfaces:**
- Consumes: `./deploy.sh staging <sha>`, `origin/staging`, `.env.staging`, GNU `flock`, Docker, Make e Curl.
- Produces: checkout detached allo SHA richiesto, invocazioni ordinate `config-check -> deploy-build -> deploy-up -> deploy-status`, health check `/up`, diagnostica con SHA precedente.

- [ ] **Step 1: Scrivere il test end-to-end fallente**

Creare `deploy/tests/deploy-script.sh`:

```sh
#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM

origin_repository="$temporary_directory/origin.git"
seed_repository="$temporary_directory/seed"
fake_bin="$temporary_directory/bin"
mkdir -p "$fake_bin"

git init -q --bare "$origin_repository"
git clone -q "$origin_repository" "$seed_repository"
git -C "$seed_repository" config user.name 'Deploy Test'
git -C "$seed_repository" config user.email 'deploy-test@example.test'

if [ ! -f "$repository_root/deploy.sh" ]; then
    printf 'deploy.sh does not exist\n' >&2
    exit 1
fi

bash -n "$repository_root/deploy.sh"

cp "$repository_root/deploy.sh" "$seed_repository/deploy.sh"
chmod +x "$seed_repository/deploy.sh"
git -C "$seed_repository" add deploy.sh
git -C "$seed_repository" commit -q -m 'add deploy script'
git -C "$seed_repository" branch -M staging
git -C "$seed_repository" push -q -u origin staging
previous_sha=$(git -C "$seed_repository" rev-parse HEAD)

printf 'target release\n' > "$seed_repository/release.txt"
git -C "$seed_repository" add release.txt
git -C "$seed_repository" commit -q -m 'add target release'
git -C "$seed_repository" push -q origin staging
target_sha=$(git -C "$seed_repository" rev-parse HEAD)
git -C "$origin_repository" symbolic-ref HEAD refs/heads/staging

cat > "$fake_bin/flock" <<'SCRIPT'
#!/bin/sh
exit 0
SCRIPT

cat > "$fake_bin/docker" <<'SCRIPT'
#!/bin/sh
set -eu
if [ "${1:-}" = info ]; then
    exit 0
fi
printf '%s\n' "$*" >> "$DEPLOY_COMMAND_LOG"
SCRIPT

cat > "$fake_bin/make" <<'SCRIPT'
#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$DEPLOY_COMMAND_LOG"
for argument in "$@"; do
    if [ -n "${DEPLOY_FAIL_TARGET:-}" ] && [ "$argument" = "$DEPLOY_FAIL_TARGET" ]; then
        exit 42
    fi
done
SCRIPT

cat > "$fake_bin/curl" <<'SCRIPT'
#!/bin/sh
set -eu
printf 'curl %s\n' "$*" >> "$DEPLOY_COMMAND_LOG"
SCRIPT

chmod +x "$fake_bin/flock" "$fake_bin/docker" "$fake_bin/make" "$fake_bin/curl"

create_checkout() {
    checkout_path=$1
    git clone -q "$origin_repository" "$checkout_path"
    git -C "$checkout_path" checkout -q --detach "$previous_sha"
}

invalid_output="$temporary_directory/invalid.log"
if "$repository_root/deploy.sh" production "$target_sha" > "$invalid_output" 2>&1; then
    printf 'deploy.sh unexpectedly accepted production\n' >&2
    exit 1
fi
grep -F 'Only staging deployments are supported.' "$invalid_output" > /dev/null

if "$repository_root/deploy.sh" staging "$target_sha" unexpected \
    > "$temporary_directory/extra-argument.log" 2>&1
then
    printf 'deploy.sh unexpectedly accepted an extra argument\n' >&2
    exit 1
fi
grep -F 'Usage: ./deploy.sh staging <commit-sha>' \
    "$temporary_directory/extra-argument.log" > /dev/null

missing_env_checkout="$temporary_directory/missing-env"
create_checkout "$missing_env_checkout"
if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$temporary_directory/missing-env-commands.log" \
    DEPLOY_LOCK_FILE="$temporary_directory/missing-env.lock" \
    "$missing_env_checkout/deploy.sh" staging "$target_sha" \
    > "$temporary_directory/missing-env.log" 2>&1
then
    printf 'deploy.sh unexpectedly accepted a missing .env.staging\n' >&2
    exit 1
fi
grep -F 'Missing required environment file:' "$temporary_directory/missing-env.log" > /dev/null

successful_checkout="$temporary_directory/success"
successful_commands="$temporary_directory/success-commands.log"
create_checkout "$successful_checkout"
: > "$successful_checkout/.env.staging"

PATH="$fake_bin:$PATH" \
DEPLOY_COMMAND_LOG="$successful_commands" \
DEPLOY_LOCK_FILE="$temporary_directory/success.lock" \
    "$successful_checkout/deploy.sh" staging "$target_sha" \
    > "$temporary_directory/success.log" 2>&1

[ "$(git -C "$successful_checkout" rev-parse HEAD)" = "$target_sha" ]

for expected_command in \
    '--no-print-directory ENV=staging config-check' \
    '--no-print-directory ENV=staging deploy-build' \
    '--no-print-directory ENV=staging deploy-up' \
    '--no-print-directory ENV=staging deploy-status'
do
    grep -Fx "$expected_command" "$successful_commands" > /dev/null
done

grep -F 'curl --fail --silent --show-error --max-time 30 http://127.0.0.1:7070/up' \
    "$successful_commands" > /dev/null
grep -F '[6/6] Verify staging' "$temporary_directory/success.log" > /dev/null
grep -F "Deployed SHA: $target_sha" "$temporary_directory/success.log" > /dev/null

failing_checkout="$temporary_directory/failure"
failing_commands="$temporary_directory/failure-commands.log"
create_checkout "$failing_checkout"
: > "$failing_checkout/.env.staging"

if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$failing_commands" \
    DEPLOY_FAIL_TARGET=deploy-build \
    DEPLOY_LOCK_FILE="$temporary_directory/failure.lock" \
    "$failing_checkout/deploy.sh" staging "$target_sha" \
    > "$temporary_directory/failure.log" 2>&1
then
    printf 'deploy.sh unexpectedly ignored a build failure\n' >&2
    exit 1
fi

grep -F 'Deploy failed during: Build images' "$temporary_directory/failure.log" > /dev/null
grep -F "Rollback command: ./deploy.sh staging $previous_sha" \
    "$temporary_directory/failure.log" > /dev/null
grep -F -- '--no-print-directory ENV=staging deploy-status' \
    "$failing_commands" > /dev/null
grep -F 'logs' "$failing_commands" > /dev/null
```

- [ ] **Step 2: Rendere eseguibile il test e verificare il fallimento**

Run:

```bash
chmod +x deploy/tests/deploy-script.sh
deploy/tests/deploy-script.sh
```

Expected: FAIL con `deploy.sh does not exist`.

- [ ] **Step 3: Implementare `deploy.sh`**

Creare `deploy.sh` con questo contenuto:

```bash
#!/usr/bin/env bash

set -Eeuo pipefail

environment=${1:-}
requested_ref=${2:-}
repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
lock_file=${DEPLOY_LOCK_FILE:-/tmp/pygeoapi-proxy-staging.deploy.lock}
health_url=${DEPLOY_HEALTH_URL:-http://127.0.0.1:7070/up}
health_timeout=${DEPLOY_HEALTH_TIMEOUT:-30}
reexecuted=${PYGEOAPI_PROXY_DEPLOY_REEXEC:-0}
started_at=${PYGEOAPI_PROXY_DEPLOY_STARTED_AT:-$(date +%s)}
previous_sha=${PYGEOAPI_PROXY_DEPLOY_PREVIOUS_SHA:-unknown}
target_sha=${PYGEOAPI_PROXY_DEPLOY_TARGET_SHA:-unknown}
current_step=Bootstrap

if [[ -t 1 && -z ${NO_COLOR:-} ]]; then
    color_blue=$'\033[34m'
    color_green=$'\033[32m'
    color_yellow=$'\033[33m'
    color_red=$'\033[31m'
    color_reset=$'\033[0m'
else
    color_blue=
    color_green=
    color_yellow=
    color_red=
    color_reset=
fi

timestamp() {
    date -u '+%Y-%m-%dT%H:%M:%SZ'
}

info() {
    printf '%s%s INFO %s%s\n' "$color_blue" "$(timestamp)" "$*" "$color_reset"
}

success() {
    printf '%s%s OK   %s%s\n' "$color_green" "$(timestamp)" "$*" "$color_reset"
}

warning() {
    printf '%s%s WARN %s%s\n' "$color_yellow" "$(timestamp)" "$*" "$color_reset"
}

fatal() {
    printf '%s%s ERROR %s%s\n' "$color_red" "$(timestamp)" "$*" "$color_reset" >&2
    exit 1
}

section() {
    current_step=$2
    printf '\n%s[%s/6] %s%s\n' "$color_blue" "$1" "$2" "$color_reset"
}

require_command() {
    command -v "$1" > /dev/null 2>&1 || fatal "Missing required command: $1"
}

on_error() {
    exit_code=$?
    failed_command=$BASH_COMMAND
    failed_line=${BASH_LINENO[0]:-$LINENO}
    trap - ERR
    set +e

    printf '\n%s%s ERROR Deploy failed during: %s%s\n' \
        "$color_red" "$(timestamp)" "$current_step" "$color_reset" >&2
    printf 'Exit code: %s\nLine: %s\nCommand: %s\n' \
        "$exit_code" "$failed_line" "$failed_command" >&2
    printf 'Current SHA: %s\nRequested SHA: %s\nPrevious SHA: %s\n' \
        "$(git -C "$repository_root" rev-parse HEAD 2>/dev/null || printf unknown)" \
        "$target_sha" "$previous_sha" >&2

    if [[ -f "$repository_root/.env.staging" ]]; then
        make --no-print-directory ENV=staging deploy-status >&2
        make --no-print-directory ENV=staging \
            LOG_FOLLOW= LOG_TAIL=100 \
            SERVICE='laravel horizon scheduler reverb' logs >&2
    fi

    if [[ $previous_sha =~ ^[0-9a-f]{40}$ ]]; then
        printf 'Rollback command: ./deploy.sh staging %s\n' "$previous_sha" >&2
    fi

    exit "$exit_code"
}

trap on_error ERR

[[ $# -eq 2 ]] || fatal 'Usage: ./deploy.sh staging <commit-sha>'
[[ $environment == staging ]] || fatal 'Only staging deployments are supported.'

cd "$repository_root"

if [[ $reexecuted != 1 ]]; then
    section 1 'Preflight checks'

    for required_command in git docker make curl flock; do
        require_command "$required_command"
    done

    [[ -f .env.staging ]] || fatal "Missing required environment file: $repository_root/.env.staging"
    git rev-parse --is-inside-work-tree > /dev/null
    docker info > /dev/null

    exec 9> "$lock_file"
    if ! flock -n 9; then
        fatal "Another staging deployment holds lock: $lock_file"
    fi

    section 2 'Checkout requested revision'
    git fetch origin --tags --prune
    target_sha=$(git rev-parse --verify "${requested_ref}^{commit}")
    git rev-parse --verify 'origin/staging^{commit}' > /dev/null
    git merge-base --is-ancestor "$target_sha" origin/staging || \
        fatal "Requested revision is not reachable from origin/staging: $target_sha"

    previous_sha=$(git rev-parse HEAD)
    info "Previous SHA: $previous_sha"
    info "Requested SHA: $target_sha"
    git checkout -f --detach "$target_sha"

    export PYGEOAPI_PROXY_DEPLOY_REEXEC=1
    export PYGEOAPI_PROXY_DEPLOY_STARTED_AT="$started_at"
    export PYGEOAPI_PROXY_DEPLOY_PREVIOUS_SHA="$previous_sha"
    export PYGEOAPI_PROXY_DEPLOY_TARGET_SHA="$target_sha"
    exec "$repository_root/deploy.sh" staging "$target_sha"
fi

[[ $(git rev-parse HEAD) == "$target_sha" ]] || \
    fatal "Checkout SHA does not match requested SHA: $target_sha"
[[ -f .env.staging ]] || fatal "Missing required environment file: $repository_root/.env.staging"

printf '\nPygeoapi Proxy staging deployment\n'
printf 'Previous SHA: %s\nTarget SHA:   %s\n' "$previous_sha" "$target_sha"

section 3 'Validate Compose configuration'
make --no-print-directory ENV=staging config-check

section 4 'Build images'
make --no-print-directory ENV=staging deploy-build

section 5 'Update services'
make --no-print-directory ENV=staging deploy-up

section 6 'Verify staging'
make --no-print-directory ENV=staging deploy-status
curl --fail --silent --show-error --max-time "$health_timeout" "$health_url" > /dev/null

finished_at=$(date +%s)
duration=$((finished_at - started_at))
success "Deployment completed in ${duration}s"
printf 'Deployed SHA: %s\nPrevious SHA: %s\nURL: https://proxygeoapi.netseven.work\n' \
    "$target_sha" "$previous_sha"
```

Impostare il bit eseguibile:

```bash
chmod +x deploy.sh
```

- [ ] **Step 4: Eseguire test sintattico ed end-to-end**

Run:

```bash
bash -n deploy.sh
deploy/tests/deploy-script.sh
```

Expected: entrambi exit `0`; il test non usa Docker reale e non modifica il checkout principale.

- [ ] **Step 5: Eseguire ShellCheck quando disponibile**

Run:

```bash
if command -v shellcheck >/dev/null 2>&1; then shellcheck deploy.sh deploy/tests/deploy-script.sh; else printf '%s\n' 'ShellCheck deferred to deployment-check CI job'; fi
```

Expected: nessun warning se ShellCheck è installato; altrimenti messaggio esplicito di rinvio al job CI.

- [ ] **Step 6: Committare il task**

Run:

```bash
git diff --check
git add deploy.sh deploy/tests/deploy-script.sh
git commit -m "feat: add staging deployment script"
```

---

### Task 4: Pipeline GitLab e suite infrastrutturale aggregata

**Files:**
- Create: `deploy/tests/gitlab-ci.sh`
- Create: `deploy/tests/run.sh`
- Create: `.gitlab-ci.yml`
- Uses: all tests under `deploy/tests/`

**Interfaces:**
- Consumes: branch/MR variables GitLab, cinque variabili SSH protette, runner generico e `deploy.sh` del Task 3.
- Produces: pipeline per MR `develop|staging`, pipeline push `staging`, job `deploy:staging` serializzato e ambiente GitLab staging.

- [ ] **Step 1: Scrivere il test fallente del contratto CI**

Creare `deploy/tests/gitlab-ci.sh`:

```sh
#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
ci_file="$repository_root/.gitlab-ci.yml"

if [ ! -f "$ci_file" ]; then
    printf '.gitlab-ci.yml does not exist\n' >&2
    exit 1
fi

require_text() {
    text=$1
    if ! grep -F "$text" "$ci_file" > /dev/null; then
        printf 'Missing GitLab CI contract: %s\n' "$text" >&2
        exit 1
    fi
}

require_text 'workflow:'
require_text '$CI_PIPELINE_SOURCE == "merge_request_event"'
require_text '$CI_MERGE_REQUEST_TARGET_BRANCH_NAME =~ /^(develop|staging)$/'
require_text '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "staging"'
require_text 'php-check:'
require_text 'frontend-check:'
require_text 'deployment-check:'
require_text 'deploy:staging:'
require_text 'GIT_STRATEGY: none'
require_text 'resource_group: staging'
require_text 'name: staging'
require_text 'url: https://proxygeoapi.netseven.work'
require_text './deploy.sh staging '\''$CI_COMMIT_SHA'\'''
require_text '*[!A-Za-z0-9_./-]*'
require_text '*[!0-9a-f]*'
require_text '${#CI_COMMIT_SHA}'
require_text 'DEPLOY_KNOWN_HOSTS'
require_text 'DEPLOY_SSH_KEY'

if grep -E 'deploy:prod|CI_COMMIT_TAG|environment:[[:space:]]*production' "$ci_file" > /dev/null; then
    printf 'Production behavior must not exist in .gitlab-ci.yml\n' >&2
    exit 1
fi

if grep -F 'StrictHostKeyChecking=no' "$ci_file" > /dev/null; then
    printf 'Host key verification must not be disabled\n' >&2
    exit 1
fi
```

Creare `deploy/tests/run.sh`:

```sh
#!/bin/sh

set -eu

tests_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

for test_script in \
    compose-oauth-env.sh \
    makefile-deploy.sh \
    compose-staging-automation.sh \
    deploy-script.sh \
    gitlab-ci.sh
do
    printf '\n==> %s\n' "$test_script"
    "$tests_directory/$test_script"
done

printf '\nAll deployment tests passed.\n'
```

- [ ] **Step 2: Rendere eseguibili i test e verificare il fallimento**

Run:

```bash
chmod +x deploy/tests/gitlab-ci.sh deploy/tests/run.sh
deploy/tests/gitlab-ci.sh
```

Expected: FAIL con `.gitlab-ci.yml does not exist`.

- [ ] **Step 3: Creare `.gitlab-ci.yml`**

Creare il file seguente:

```yaml
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" && $CI_MERGE_REQUEST_TARGET_BRANCH_NAME =~ /^(develop|staging)$/'
    - if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "staging"'
    - when: never

stages:
  - quality
  - test
  - deploy

deployment-check:
  stage: quality
  image: docker:27-cli
  before_script:
    - apk add --no-cache bash git jq make shellcheck
  script:
    - deploy/tests/run.sh
    - shellcheck deploy.sh deploy/tests/*.sh

php-check:
  stage: test
  image: serversideup/php:8.5-cli
  variables:
    APP_ENV: testing
    APP_KEY: base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
    COMPOSER_CACHE_DIR: $CI_PROJECT_DIR/.cache/composer
  before_script:
    - cd proxy
    - composer install --no-interaction --prefer-dist --no-progress
  script:
    - composer test

frontend-check:
  stage: test
  image:
    name: oven/bun:1.3.14-alpine
    docker:
      user: root
  before_script:
    - apk add --no-cache nodejs-current
    - cd proxy
    - node --version
    - bun --version
    - bun ci
  script:
    - bun run lint:check
    - bun run format:check
    - bun run types:check
    - bun test

deploy:staging:
  stage: deploy
  image: alpine:3.20
  variables:
    GIT_STRATEGY: none
  needs:
    - deployment-check
    - php-check
    - frontend-check
  resource_group: staging
  interruptible: false
  environment:
    name: staging
    url: https://proxygeoapi.netseven.work
    deployment_tier: staging
  before_script:
    - apk add --no-cache openssh-client
    - install -m 700 -d ~/.ssh
    - cp "$DEPLOY_KNOWN_HOSTS" ~/.ssh/known_hosts
    - chmod 600 ~/.ssh/known_hosts "$DEPLOY_SSH_KEY"
    - eval "$(ssh-agent -s)"
    - ssh-add "$DEPLOY_SSH_KEY"
  script:
    - |
      case "$DEPLOY_PATH" in
        /*) ;;
        *) printf '%s\n' 'DEPLOY_PATH must be absolute' >&2; exit 1 ;;
      esac
      case "$DEPLOY_PATH" in
        *[!A-Za-z0-9_./-]*) printf '%s\n' 'DEPLOY_PATH contains unsupported characters' >&2; exit 1 ;;
      esac
      case "$CI_COMMIT_SHA" in
        *[!0-9a-f]*|'') printf '%s\n' 'CI_COMMIT_SHA is not hexadecimal' >&2; exit 1 ;;
      esac
      if [ "${#CI_COMMIT_SHA}" -ne 40 ]; then
        printf '%s\n' 'CI_COMMIT_SHA must contain 40 hexadecimal characters' >&2
        exit 1
      fi
      ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && ./deploy.sh staging '$CI_COMMIT_SHA'"
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "staging"'
```

Non aggiungere tag runner: il progetto 3P usa correttamente il runner generico senza tag. Non aggiungere cache CI nel primo incremento; misurare prima i tempi reali.

- [ ] **Step 4: Eseguire la suite infrastrutturale completa**

Run:

```bash
deploy/tests/run.sh
```

Expected: tutti e cinque gli script PASS e messaggio finale `All deployment tests passed.`.

- [ ] **Step 5: Validare la configurazione con GitLab CI Lint**

Con un token API valido disponibile soltanto nell'ambiente shell:

```bash
lint_payload=$(mktemp)
jq -Rs '{content: .}' .gitlab-ci.yml > "$lint_payload"
curl --fail --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header 'Content-Type: application/json' \
  --data-binary "@$lint_payload" \
  'https://gitlab.netseven.it/api/v4/projects/737/ci/lint' | jq -e '.valid == true'
rm -f "$lint_payload"
```

Expected: `true`. Non stampare né salvare `GITLAB_TOKEN`.

- [ ] **Step 6: Committare il task**

Run:

```bash
git diff --check
git add .gitlab-ci.yml deploy/tests/gitlab-ci.sh deploy/tests/run.sh
git commit -m "ci: add staging verification and deployment pipeline"
```

---

### Task 5: Documentazione operativa e verifica completa

**Files:**
- Create: `deploy/README.md`
- Modify: `README.md:134-200,321-375`
- Verify: every file changed in Tasks 1-4

**Interfaces:**
- Consumes: nomi job, variabili, target e comandi definiti nei task precedenti.
- Produces: procedura completa per amministratore GitLab e utente server `gitlab_deploy`, senza segreti reali.

- [ ] **Step 1: Aggiungere la panoramica CI/CD al README principale**

Inserire dopo `## Prima configurazione` una sezione che contenga esattamente questi concetti e comandi:

````markdown
## CI/CD staging

Le Merge Request verso `develop` e `staging` eseguono i controlli PHP,
frontend e Docker Compose. Un merge riuscito su `staging` avvia inoltre il
deploy automatico su `https://proxygeoapi.netseven.work`.

Il job GitLab si collega via SSH con l'utente `gitlab_deploy` e invoca nel checkout
stabile:

```bash
./deploy.sh staging <commit-sha>
```

Il server conserva `.env.staging`, costruisce le immagini, esegue le migrazioni
Laravel `--force --isolated`, rigenera le cache e verifica gli health check.
Le immagini applicative non vengono pubblicate nel Container Registry.

La configurazione GitLab, il bootstrap del server, il rollback e il
troubleshooting sono descritti in `deploy/README.md`.
````

Nella sezione comandi rapidi documentare anche:

```bash
make staging config-check
make staging deploy-build
make staging deploy-up
make staging deploy-status
```

Aggiornare `## File principali` con `.gitlab-ci.yml`, `deploy.sh` e `deploy/README.md`. Aggiornare `## Note operative` per spiegare che Laravel migra e ottimizza, mentre Horizon, Scheduler e Reverb ottimizzano senza migrare.

- [ ] **Step 2: Creare la procedura `deploy/README.md`**

Il documento deve avere le sezioni e i contenuti operativi seguenti, con comandi copiabili:

````markdown
# Staging GitLab deployment

## Topologia

GitLab runner -> SSH -> gitlab_deploy -> stable checkout -> deploy.sh -> Docker Compose

Checkout: `/docker-data/configuration/pygeoapi-proxy`
URL: `https://proxygeoapi.netseven.work`

## Prerequisiti server

```bash
sudo -u gitlab_deploy test -d /docker-data/configuration/pygeoapi-proxy/.git
sudo -u gitlab_deploy test -f /docker-data/configuration/pygeoapi-proxy/.env.staging
sudo -u gitlab_deploy sh -lc 'command -v git bash flock curl docker'
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy remote -v
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy ls-remote --exit-code origin refs/heads/staging
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy status --short --untracked-files=no
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy check-ignore .env.staging
sudo -u gitlab_deploy stat -c '%a %U:%G %n' /docker-data/configuration/pygeoapi-proxy/.env.staging
sudo -u gitlab_deploy docker info
sudo -u gitlab_deploy docker compose version
sudo nginx -T 2>&1 | grep -E '127\.0\.0\.1:(7070|7071)'
```

L'utente `gitlab_deploy` deve poter usare Docker senza password interattiva. Il
checkout è gestito dal deploy: le modifiche manuali ai file versionati vengono
sostituite. `.env.staging` resta ignorato e non viene rimosso.

Il controllo `status --short --untracked-files=no` deve essere vuoto prima del
primo deploy. `check-ignore` deve confermare `.env.staging`; correggere owner e
permessi se `stat` mostra accessi più ampi di quelli necessari. Il dump Nginx
deve mostrare i proxy verso entrambe le porte loopback `7070` e `7071`.

## Chiave SSH e known hosts

Usare una chiave Ed25519 dedicata al progetto. Verificare la fingerprint della
host key tramite un canale amministrativo prima di caricare il risultato di
`ssh-keyscan` in GitLab. Non disabilitare la verifica dell'host.

Da una workstation amministrativa, usando un percorso temporaneo protetto:

```bash
umask 077
ssh-keygen -t ed25519 -a 100 -C 'gitlab-pygeoapi-proxy-staging' -f ./pygeoapi-proxy-staging
ssh-copy-id -i ./pygeoapi-proxy-staging.pub "gitlab_deploy@$DEPLOY_HOST"
ssh-keyscan -H "$DEPLOY_HOST" > ./pygeoapi-proxy-staging.known_hosts
ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts
```

Confrontare l'ultima fingerprint con quella ottenuta dal server tramite un
canale distinto. Caricare la chiave privata e il file `known_hosts` in GitLab,
quindi eliminare in modo sicuro le copie temporanee quando non servono più.

## Variabili GitLab protette

- `DEPLOY_SSH_KEY`: File, protected, masked se supportato.
- `DEPLOY_KNOWN_HOSTS`: File, protected.
- `DEPLOY_HOST`: protected.
- `DEPLOY_USER`: protected, valore `gitlab_deploy`.
- `DEPLOY_PATH`: protected, valore `/docker-data/configuration/pygeoapi-proxy`.

## Impostazioni progetto

- Proteggere `staging` con push `No one`.
- Abilitare `Pipelines must succeed`.
- Proteggere l'ambiente `staging`.
- Le Merge Request verso `main` restano bloccate finché non viene aggiunta la
  pipeline production.

## Primo deploy sorvegliato

```bash
cd /docker-data/configuration/pygeoapi-proxy
git fetch origin --tags --prune
git checkout -f --detach "$(git rev-parse origin/staging)"
./deploy.sh staging "$(git rev-parse origin/staging)"
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
make staging deploy-status
```

## Deploy automatico

Ogni merge su `staging` esegue quality gate e poi `deploy:staging`. Il job
passa `CI_COMMIT_SHA`; `resource_group` e `flock` impediscono concorrenza.

## Deploy manuale e rollback

```bash
./deploy.sh staging <sha-raggiungibile-da-origin-staging>
```

Il rollback ricostruisce il codice precedente ma non annulla le migrazioni.
Verificare la compatibilità dello schema prima di eseguirlo.

## Diagnostica

```bash
make staging deploy-status
make staging logs SERVICE='laravel horizon scheduler reverb'
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
```

Se la build fallisce, i container precedenti restano attivi. Se migrazione o
avvio falliscono, consultare la fase e lo SHA stampati dal job. Non eseguire
`docker compose down -v` e non fare prune globale sul server condiviso.
````

Integrare nello stesso documento una tabella `Problema | Controllo | Azione` per: chiave SSH rifiutata, host key errata, `.env.staging` assente, lock occupato, build fallita, migrazione fallita, Laravel unhealthy e Reverb unhealthy. Ogni azione deve rimandare a uno dei comandi concreti già documentati.

- [ ] **Step 3: Eseguire tutti i controlli applicativi e infrastrutturali**

Run dalla root:

```bash
deploy/tests/run.sh
bash -n deploy.sh deploy/tests/*.sh
make ENV=staging ENV_FILE=.env.staging.example config-check
git diff --check
```

Run da `proxy/`:

```bash
composer install --no-interaction --prefer-dist
composer test
bun ci
bun run lint:check
bun run format:check
bun run types:check
bun test
bun run build
```

Expected: tutti i comandi PASS. `composer test` include Pint e Pest/PHPUnit; i comandi Bun coprono lint, formato, tipi, test e build asset.

- [ ] **Step 4: Costruire le immagini staging senza avviare lo stack**

Run dalla root:

```bash
make ENV=staging ENV_FILE=.env.staging.example deploy-build
```

Expected:

- Composer production install completato nello stage `composer_deps`;
- `bun ci` e `bun run build` completati nello stage `assets`;
- immagini Laravel e pygeoapi costruite;
- nessun container staging avviato.

- [ ] **Step 5: Eseguire la scansione finale di sicurezza e coerenza**

Run:

```bash
git status --short
git diff --check
if rg -n 'StrictHostKeyChecking=no|deploy:prod|CI_COMMIT_TAG|docker compose down -v|docker image prune' \
    .gitlab-ci.yml deploy.sh Makefile deploy/tests
then
    printf '%s\n' 'Forbidden deployment pattern found in executable files' >&2
    exit 1
fi
rg -n 'docker compose down -v|docker image prune' README.md deploy/README.md
git diff -- . ':!docs/superpowers/plans/2026-07-18-staging-gitlab-ci-cd-implementation.md'
```

Expected:

- nessuna corrispondenza vietata nei file eseguibili; la seconda ricerca trova soltanto le frasi documentali che spiegano esplicitamente di non eseguire i comandi distruttivi;
- nessun `.env.staging`, token, chiave privata o valore segreto nel diff;
- nessuna modifica ai file production.

- [ ] **Step 6: Committare documentazione e aggiustamenti finali**

Run:

```bash
git add README.md deploy/README.md
git commit -m "docs: document staging GitLab deployment"
```

Se le verifiche hanno richiesto correzioni ai file dei task precedenti, includerle nello stesso commit soltanto quando sono strettamente documentali o di formattazione; per correzioni comportamentali creare un commit dedicato con relativo test.

---

### Task 6: Attivazione GitLab e bootstrap server con checkpoint umano

**Files:**
- No repository changes expected.
- Procedure source: `deploy/README.md`

**Interfaces:**
- Consumes: commit di implementazione già presente su `develop`, accesso Owner/Maintainer GitLab, amministratore server e valori reali delle cinque variabili di deploy.
- Produces: branch staging protetto senza push, merge gate abilitato, ambiente protetto, SSH funzionante e primo deploy sorvegliato.

- [ ] **Step 1: Fermarsi prima delle modifiche esterne**

Mostrare all'utente:

- commit implementati e test eseguiti;
- elenco delle cinque variabili ancora da configurare;
- conseguenza dell'abilitazione di `Pipelines must succeed` su `main`;
- comandi server descritti in `deploy/README.md`.

Expected: approvazione esplicita prima di modificare impostazioni GitLab o server.

- [ ] **Step 2: Configurare GitLab dopo approvazione**

Nella UI del progetto `net7-main/ingv/pygeoapi-proxy`:

1. caricare `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` come protected;
2. impostare push su `staging` a `No one` mantenendo il merge ai ruoli concordati;
3. abilitare `Pipelines must succeed`;
4. proteggere l'ambiente `staging`.

Expected: nessun valore segreto mostrato nei log o riportato nella risposta.

- [ ] **Step 3: Eseguire il bootstrap server insieme all'amministratore**

Seguire nell'ordine `Prerequisiti server`, `Chiave SSH e known hosts` e `Primo deploy sorvegliato` di `deploy/README.md`.

Expected:

- comando manuale `deploy.sh` exit `0`;
- server checkout allo SHA concordato;
- `make staging deploy-status` mostra tutti i servizi richiesti healthy/running;
- `/up` risponde con successo;
- Nginx continua a servire `https://proxygeoapi.netseven.work`.

- [ ] **Step 4: Verificare la prima pipeline reale**

Creare e mergiare una Merge Request controllata da `develop` a `staging`, quindi verificare:

1. `deployment-check`, `php-check` e `frontend-check` verdi;
2. un solo job `deploy:staging` grazie a `resource_group`;
3. SHA del job uguale a `git rev-parse HEAD` sul server;
4. log con Composer, Bun/Vite, migrazione, optimize e health check;
5. ambiente GitLab `staging` aggiornato.

Expected: pipeline verde e staging raggiungibile.

---

## Final Verification Checklist

- [ ] Ogni requisito della design spec è coperto da almeno un task.
- [ ] `deploy/tests/run.sh` passa integralmente.
- [ ] GitLab CI Lint restituisce `valid: true`.
- [ ] Suite Composer/Pest e Bun passano.
- [ ] Build staging completa senza avviare container.
- [ ] `deploy.sh` distribuisce soltanto SHA raggiungibili da `origin/staging`.
- [ ] `.env.staging` non viene creato, letto nei log o versionato.
- [ ] Il deploy non contiene production o Container Registry.
- [ ] README e procedura operativa coincidono con nomi e comandi implementati.
- [ ] Nessun file production è cambiato.
- [ ] Le azioni GitLab/server attendono approvazione esplicita.
