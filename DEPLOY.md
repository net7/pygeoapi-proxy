# Deployment guide

[Italiano](DEPLOY.it.md) · [Project overview](README.md)

## Overview

Development and staging use the shared Compose application stack with Laravel,
GeoServer, MariaDB, Redis, Horizon, Scheduler, and Reverb. Development also
adds Vite, phpMyAdmin, and Mailpit.

All deployment files, examples, and guides in this repository refer
exclusively to `develop` and `staging`. Make supports both environments;
`deploy-dev-staging.sh` automates staging only through GitLab CI/CD or a manual
invocation.

## Environments

The Makefile supports two isolated environments. `develop` is the default.

| Environment | Compose project | Published endpoints | Intended use |
| --- | --- | --- | --- |
| `develop` | `pygeoapi-proxy-develop` | App `8088`, Reverb `8089`, Vite `5174`, GeoServer `8091`, phpMyAdmin `8090`, Mailpit `8026` | Local development |
| `staging` | `pygeoapi-proxy-staging` | App `127.0.0.1:7070`, Reverb `127.0.0.1:7071` | GitLab-managed staging behind host Nginx |

The normal command form is:

```bash
make [develop|staging] <target>
```

Examples:

```bash
make up
make staging logs SERVICE=laravel
```

The explicit variable form is equivalent:

```bash
make up ENV=staging
```

The `make -e staging up` form is also supported.

Named volumes are isolated by `COMPOSE_PROJECT_NAME`, so database, Redis,
Laravel storage, and GeoServer data do not overlap between development and
staging.

## Architecture and services

```text
Development / staging
  Laravel / Horizon / Scheduler / Reverb
        |          |          |
     MariaDB     Redis    GeoServer
        |
        +---- HTTPS ----> remote OGC Processes API
```

| Service | Responsibility | Exposure |
| --- | --- | --- |
| `laravel` | Development/staging HTTP application | Published locally or on staging loopback |
| `horizon` | Redis-backed Laravel queue workers | Internal |
| `scheduler` | `php artisan schedule:work` | Internal |
| `reverb` | Laravel WebSocket server | Published locally or on staging loopback |
| `mariadb` | Application database | Internal |
| `redis` | Cache, sessions, queues, and Reverb scaling | Internal |
| `geoserver` | Publishes GeoTIFF/SLD outputs as map layers | Host port `8091` only in development |
| `vite` | Frontend development server built with Bun | Development only, host port `5174` |
| `phpmyadmin` | MariaDB administration UI | Development only, host port `8090` |
| `mailpit` | Local SMTP sink and email UI | Development only, host port `8026` |

Development and staging default `OGC_PROCESSES_BASE_URL` to the separately
operated `https://voice.pi.ingv.it/geoinquire/`. Laravel reaches its
environment's GeoServer at `http://geoserver:8080/geoserver` through a private
Compose network.

## Prerequisites

- Git;
- Docker Engine with the Docker Compose plugin;
- GNU Make;
- an environment file created from the matching versioned template.

The staging deployment account also needs Bash, Curl, `flock`, and SSH access
to the Git remote. Host Nginx and Certbot are required for the public staging
endpoint.

Check the required command-line tools:

```bash
git --version
docker --version
docker compose version
make --version
```

## Configure an environment

Create the selected development or staging environment file once:

```bash
make env
make staging env
```

These commands copy the matching template only when the destination is absent:

| Environment | Template | Local file |
| --- | --- | --- |
| Development | `.env.develop.example` | `.env.develop` |
| Staging | `.env.staging.example` | `.env.staging` |

Environment files contain secrets and must never be committed. Before using
staging, replace at least:

- `APP_KEY`
- `APP_URL`
- `MARIADB_ROOT_PASSWORD`
- `MARIADB_PASSWORD`
- `REVERB_APP_KEY`
- `REVERB_APP_SECRET`
- `REVERB_HOST`
- `REVERB_SCHEME`

Also configure a non-default `GEOSERVER_PASSWORD` when GeoServer is enabled.
Set the public GeoServer URL if it differs from the application default.
Configure SMTP credentials when `MAIL_MAILER` is not `log`.

Google and ORCID login are optional. Enable them only with real provider
settings:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ORCID_CLIENT_ID`
- `ORCID_CLIENT_SECRET`
- `ORCID_REDIRECT_URI`

The templates configure the external OGC Processes dependency with:

```dotenv
OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
```

Override this value when an environment uses a different remote deployment.
Do not expose database, Redis, or GeoServer ports in staging unless the
infrastructure design explicitly requires it.

For server-managed environments, restrict the environment file:

```bash
chmod 600 .env.staging
```

Verify remote connectivity from the deployment host:

```bash
OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
curl --fail --silent --show-error \
  "${OGC_PROCESSES_BASE_URL%/}/processes?f=json" > /dev/null
```

## Start the stack

Validate the development or staging Compose configuration without printing
resolved secrets:

```bash
make config-check
make staging config-check
```

Build and start:

```bash
make up
make staging up
```

`make up` creates a missing development environment file from its template.
Review the staging file before starting that stack.

Inspect status and health:

```bash
make ps
make staging deploy-status
```

## Runtime and image builds

The development/staging Laravel image uses a multi-stage build:

- `serversideup/php:8.5-fpm-nginx` for Composer dependencies and runtime;
- `oven/bun:latest` for dependency installation and frontend builds;
- `node:latest` for Vite's Node shebang runtime.

Bun remains the package manager and build runner. Node is copied into the final
image so Vite can execute its expected runtime.

Compose also uses:

- `docker.osgeo.org/geoserver:2.27.1`;
- `mariadb:latest`;
- `redis:alpine`;
- `phpmyadmin:latest` in development;
- `axllent/mailpit:latest` in development.

Tags marked `latest` or `alpine` are floating. Rebuilds can therefore pick up
new upstream releases. Review and test such changes before deployment.

The default PHP memory limit is `2G`. OPcache is disabled with timestamp
validation in development; it is enabled with timestamp validation disabled
in staging.

Build application images:

```bash
make build
make staging build
```

The staging deploy path uses plain build logs and builds only the Laravel
application image:

```bash
make staging deploy-build
```

## Development

Start the complete development stack:

```bash
make env
make up
```

Default local URLs:

- application: `http://localhost:8088`
- Reverb: `http://localhost:8089`
- Vite: `http://localhost:5174`
- GeoServer: `http://localhost:8091/geoserver`
- phpMyAdmin: `http://localhost:8090`
- Mailpit: `http://localhost:8026`

The Laravel source is bind-mounted from `proxy/`. Vite uses a dedicated Linux
`node_modules` volume so native dependencies from a macOS host are not reused
inside the container.

Vite binds to `0.0.0.0:5173` in the container and advertises
`http://localhost:5174` to the browser. `0.0.0.0` is a bind address, not a
browser URL.

Useful development commands:

```bash
make test
make pint
make logs SERVICE=laravel
```

## Staging

The staging template binds Laravel and Reverb to loopback:

```text
Laravel  127.0.0.1:7070
Reverb   127.0.0.1:7071
```

Host Nginx publishes both services at:

```text
https://proxygeoapi.netseven.work
```

The versioned virtual host starts from
`deploy/nginx/proxygeoapi.netseven.work.conf`. Follow the dedicated
[Nginx and TLS runbook](deploy/nginx/README.md) for installation, Basic Auth,
Certbot bootstrap, WebSocket proxying, and reload validation.

The Laravel container runs isolated forced migrations, creates the storage
link, and rebuilds Laravel caches. Horizon, Scheduler, and Reverb rebuild their
caches but do not run migrations.

## Staging CI/CD

The staging topology is:

```text
GitLab runner -> SSH -> gitlab_deploy -> stable checkout
              -> deploy-dev-staging.sh -> Docker Compose
```

Current operational endpoints:

- checkout: `/docker-data/configuration/pygeoapi-proxy`
- public URL: `https://proxygeoapi.netseven.work`
- SSH endpoint: `91.107.228.84:1024`
- SSH host-key fingerprint:
  `SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI`
- Laravel loopback port: `127.0.0.1:7070`
- Reverb loopback port: `127.0.0.1:7071`

Merge requests targeting `develop` or `staging` run:

- `deployment-check`;
- `php-check`;
- `frontend-check`.

A push to `staging` runs the same gates and then `deploy:staging`. The runner
does not build or publish application images. It connects to the server and
executes:

```bash
./deploy-dev-staging.sh staging <commit-sha>
```

Composer, Bun, Vite, and Docker builds run on the deployment server. GitLab
`resource_group: staging` serializes CI jobs, while `flock` prevents overlap
with a manual deployment.

The remote configuration was verified through the GitLab API on 2026-07-26:
the project is
[`net7-main/ingv/pygeoapi-proxy`](https://gitlab.netseven.it/net7-main/ingv/pygeoapi-proxy)
(ID `737`), `develop` is the default protected branch, and the observed
successful staging push pipeline ran all four non-optional jobs in the expected
`quality -> test -> deploy` flow. Use the
[GitLab pipelines page](https://gitlab.netseven.it/net7-main/ingv/pygeoapi-proxy/-/pipelines)
for current run status.

## Deployment account

Staging uses the existing `gitlab_deploy` account. Inspect it without changing
it:

```bash
getent passwd gitlab_deploy
id gitlab_deploy
sudo -u gitlab_deploy sh -lc 'printf "home=%s\n" "$HOME"; id; command -v git docker make curl flock'
```

The account must belong to `docker` and `www-data`. Do not grant passwordless
sudo. The pipeline does not create the account and does not edit
`authorized_keys`; installing a dedicated public key is a supervised
administrative operation.

## Server prerequisites

Run these checks with an administrative account:

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

The tracked-file status must be empty before the first deployment. The
deployment script replaces versioned files, but deliberately avoids
`git clean -fdx`, preserving ignored server state such as `.env.staging`.
`check-ignore` must confirm that the environment file is ignored. Keep
`.env.staging` owned by `gitlab_deploy` with mode `0600`.

The Nginx dump must contain proxies for both loopback ports.

## SSH key and known hosts

Use a project-specific Ed25519 key. From a protected temporary directory on an
administrative workstation:

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

Read the authoritative server fingerprint on the server:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

It must match:

```text
SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI
```

Verify it through a separate administrative channel before uploading
`known_hosts` to GitLab. Never disable host-key checking. After the GitLab
variables are configured, securely remove temporary private-key copies.

## Protected GitLab variables

Configure these in **Settings > CI/CD > Variables**:

| Variable | Type | Protection | Value or scope |
| --- | --- | --- | --- |
| `DEPLOY_SSH_KEY` | File | Protected; masked when supported | Dedicated private key |
| `DEPLOY_KNOWN_HOSTS` | File | Protected | Independently verified host key |
| `DEPLOY_HOST` | Variable | Protected | Staging hostname or IP |
| `DEPLOY_PORT` | Variable | Protected | `1024` |
| `DEPLOY_USER` | Variable | Protected | `gitlab_deploy` |
| `DEPLOY_PATH` | Variable | Protected | `/docker-data/configuration/pygeoapi-proxy` |

Do not copy `.env.staging` into GitLab variables. It remains only on the
server.

## GitLab project settings

1. Keep `staging` protected.
2. Configure **Allowed to merge** for authorized project roles.
3. Set **Allowed to push and merge > No one** to block direct pushes without
   preventing authorized merges.
4. Enable **Pipelines must succeed**.
5. On Premium or Ultimate, protect the `staging` environment and restrict
   deployment to authorized roles.

The current instance uses GitLab Community Edition, where protected
environments are unavailable. Its security boundary is the protected
`staging` branch with no direct pushes plus protected deployment variables.

The live branch rule verified on 2026-07-26 sets push access to **No one**,
merge access to **Developers + Maintainers**, and disables force-push for
`staging`. `develop`, `main`, and `staging` are all protected.

The workflow gate intentionally does not run for `main`.

## First automatic deployment bootstrap

Use this procedure before the first CI deployment with the new script name, when
the current `staging` checkout does not yet track `deploy-dev-staging.sh`.
Create the merge request from `develop` to `staging`, wait for all quality
gates, and do not merge it yet.

As a server administrator, install the bootstrap from the exact authenticated
head of `develop`:

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

`BOOTSTRAP_SOURCE_SHA` must equal the merge request source SHA and
`refs/heads/develop` immediately before merge. Otherwise, do not merge.

Remove only an untracked bootstrap with:

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

The bootstrap does not change `HEAD`, start containers, or read the contents of
`.env.staging`. The first automatic job replaces it with the merge commit's
tracked file through `git checkout -f`.

## Verify the first automatic deployment

After the staging push pipeline and `deploy:staging` job succeed:

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

`DEPLOYED_SHA` must match the merge request `merge_commit_sha` and the staging
push pipeline SHA. `deploy-dev-staging.sh` must be tracked and the working tree must be
clean. The Basic Auth value is entered without echo and exists only in the
temporary shell; never put it in the repository, command history, or deployment
variables.

## Automatic deployment

Every successful push pipeline on `staging` passes `CI_COMMIT_SHA` to:

```bash
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && ./deploy-dev-staging.sh staging '$CI_COMMIT_SHA'"
```

On the server, `deploy-dev-staging.sh`:

1. validates tools, Docker, `.env.staging`, and the deployment lock;
2. fetches Git refs and confirms the requested SHA is reachable from
   `origin/staging` and contains `deploy-dev-staging.sh`;
3. checks out that exact SHA in detached mode and re-executes the versioned
   script;
4. validates Compose;
5. builds the Laravel image;
6. stops workers, updates Laravel with migration-safe automation, updates the
   remaining services, and checks health.

If the image build fails, previous containers keep running. Later failures
print the failed phase, command, SHA values, service status, and recent logs.
They print a rollback command only when the previous revision contains
`deploy-dev-staging.sh`.

## Manual deployment and rollback

From the stable server checkout:

```bash
./deploy-dev-staging.sh staging <sha-reachable-from-origin-staging>
```

The script refuses revisions that are not ancestors of `origin/staging` or do
not contain `deploy-dev-staging.sh`. This preflight runs before checkout, so a
rejected old revision leaves the current checkout unchanged.

Rollback redeploys a previous compatible revision that contains
`deploy-dev-staging.sh`:

```bash
./deploy-dev-staging.sh staging <previous-commit-sha>
```

> **Warning:** rollback rebuilds and redeploys application code, but it does
> not reverse database migrations. Confirm schema compatibility and take a
> database backup before rolling back. There is no automatic rollback.

## Routine operations

These Make targets operate only on development and staging. Show available
targets:

```bash
make help
```

Configuration and builds:

```bash
make config
make staging config-check
make build
make staging deploy-build
```

Lifecycle:

```bash
make up
make start
make stop
make restart
make down
make ps
```

`make start` does not rebuild. `make down` removes containers and the Compose
network but keeps named volumes.

Logs and shells:

```bash
make logs
make logs SERVICE=laravel
make staging logs SERVICE='laravel horizon scheduler reverb'
make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200
make shell
make artisan CMD="route:list"
```

Database and application maintenance:

```bash
make migrate
make seed
make fresh
make optimize
make clear
make horizon-status
```

`make fresh` runs `migrate:fresh --seed` and destroys existing application
tables. Use it only when data loss is intended.

Development quality commands:

```bash
make test
make pint
make composer CMD="show"
make bun-install
make bun-build
```

> **Danger:** `make destroy` runs `docker compose down -v --remove-orphans`.
> It removes the selected environment's named volumes, including MariaDB,
> Redis, Laravel storage, and GeoServer data. Confirm `ENV` before running it.

## Database backups

Create a backup of the configured database:

```bash
make artisan CMD="db:backup backup"
```

Backups are stored with mode `0600` under:

```text
storage/app/private/database-backups
```

In staging, `storage/` is on the shared stack's `laravel-storage` named volume.
A volume is not an off-host backup: copy approved dumps to protected external
storage according to the retention policy.

Restore interactively:

```bash
make artisan CMD="db:backup restore <filename>"
```

Skip the confirmation only in a controlled recovery procedure:

```bash
make artisan CMD="db:backup restore <filename> --force"
```

> **Warning:** restore replaces the current database. Stop or drain workers,
> verify the selected environment and dump, and preserve the current database
> before continuing.

## Health checks and diagnostics

Main staging checks:

```bash
make staging deploy-status
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
make staging logs SERVICE='laravel horizon scheduler reverb'
make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200
make staging logs SERVICE=reverb LOG_FOLLOW= LOG_TAIL=200
ps -ef | grep '[d]eploy-dev-staging.sh staging'
```

Public staging health is protected by Basic Auth. Enter credentials without
placing them directly in a command:

```bash
read -r -s -p 'Staging Basic Auth (user:password): ' STAGING_BASIC_AUTH
printf '\n'
curl --fail --silent --show-error \
  --user "$STAGING_BASIC_AUTH" \
  https://proxygeoapi.netseven.work/up > /dev/null
unset STAGING_BASIC_AUTH
```

Validate Nginx before reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Troubleshooting

| Problem | Check | Action |
| --- | --- | --- |
| SSH key rejected | `ssh -vvv -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging "gitlab_deploy@$DEPLOY_HOST" true` | Check the public key in `~gitlab_deploy/.ssh/authorized_keys`, ownership, and permissions; rotate only when necessary. |
| Wrong host key | Compare `ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts` with the server host key | Verify through a separate channel, regenerate `known_hosts`, then update `DEPLOY_KNOWN_HOSTS`. |
| Missing `.env.staging` | `sudo -u gitlab_deploy test -f /docker-data/configuration/pygeoapi-proxy/.env.staging` | Restore the approved file from the secret store or backup; deployment does not create it. |
| Deployment lock busy | `ps -ef \| grep '[d]eploy-dev-staging.sh staging'` | Wait for the active deployment; remove a stale lock only after confirming no process exists. |
| Image build fails | `make staging deploy-build` | Fix the first Composer, Bun/Vite, or Docker error, then redeploy the same SHA. |
| Migration fails | Inspect Laravel logs with `LOG_FOLLOW=` | Fix the migration or database connectivity; verify schema compatibility before rollback. |
| Laravel unhealthy | `make staging deploy-status` and `curl http://127.0.0.1:7070/up` | Inspect bounded Laravel logs, correct the cause, and redeploy. |
| Reverb unhealthy | Check Reverb logs and status | Verify Redis, Reverb keys, loopback port `7071`, and the Nginx WebSocket location. |
| Remote OGC API unavailable | Run the documented Curl check from the deployment host and inspect `make staging logs SERVICE='laravel horizon' LOG_FOLLOW= LOG_TAIL=200` | Verify `OGC_PROCESSES_BASE_URL`, DNS, TLS, upstream authentication, timeouts, and remote service availability. |
| GeoServer publication fails | Inspect Laravel and GeoServer logs | Verify GeoServer credentials, workspace, storage, and internal REST URL. |

Do not run a global `docker image prune` or `docker compose down -v` on the
shared server during diagnosis.

## Security notes

- Keep `.env.staging` out of Git with mode `0600`.
- Use dedicated SSH keys and protected GitLab variables.
- Verify SSH host keys out of band; never use `StrictHostKeyChecking=no`.
- Block direct pushes to `staging` and require successful pipelines.
- Keep development/staging MariaDB, Redis, and GeoServer private.
- Treat each configured OGC Processes API as a separately operated dependency
  and keep its credentials outside Git when authentication is required.
- Replace example secrets and review every default before use.
- Treat database dumps as secrets and copy them to encrypted, access-controlled
  off-host storage.
- Review floating container tags before rebuilds.
- Never include Basic Auth, OAuth, SMTP, database, GeoServer, or Reverb
  credentials in documentation, Git history, commands, or CI logs.

## Deployment file map

| File | Purpose |
| --- | --- |
| `compose.yaml` | Common services, networks, volumes, and defaults |
| `compose.develop.yaml` | Development bind mounts, ports, Vite, phpMyAdmin, and Mailpit |
| `compose.staging.yaml` | Staging automation and persistent Laravel storage |
| `.env.develop.example`, `.env.staging.example` | Versioned Make environment templates |
| `Makefile` | Development/staging operational commands |
| `proxy/Dockerfile` | Laravel runtime and frontend multi-stage build |
| `.gitlab-ci.yml` | Quality gates and automatic staging deployment |
| `deploy-dev-staging.sh` | Versioned, locked staging-only deployment orchestrator |
| `deploy/README.md` | Deployment documentation index |
| `deploy/nginx/README.md` | Staging host Nginx and TLS runbook |
| `deploy/nginx/proxygeoapi.netseven.work.conf` | Versioned staging virtual host |
| `deploy/tests/` | Deployment automation contract tests |
