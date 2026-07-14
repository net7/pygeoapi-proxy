# Staging Nginx Reverse Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish staging through the existing host Nginx, with Laravel bound to `127.0.0.1:7070`, Reverb bound to `127.0.0.1:7071`, and public HTTPS/WSS on `proxygeoapi.netseven.work:443` after Certbot.

**Architecture:** Docker Compose exposes only loopback upstreams through a backward-compatible bind-address variable. A versioned HTTP-only Nginx vhost routes normal traffic to Laravel and `/app` plus `/apps` traffic to Reverb; deployment documentation then hands TLS installation and redirect creation to Certbot's Nginx plugin.

**Tech Stack:** Docker Compose, GNU Make, NGINX, Laravel Reverb, Certbot, POSIX shell assertions

**Execution constraint:** Execute inline on the current `develop` branch. Do not create a Git worktree.

---

## File map

- Modify `compose.yaml`: make the host bind address configurable for Laravel and Reverb port publications.
- Modify `.env.staging.example`: version the loopback bind, host ports `7070/7071`, and public Reverb port `443`.
- Modify `.env.staging`: apply the same non-secret values to the active ignored staging environment while preserving every other line.
- Create `deploy/nginx/proxygeoapi.netseven.work.conf`: HTTP-only bootstrap vhost with separate Laravel and Reverb upstreams.
- Create `deploy/nginx/tests/nginx.conf`: minimal main-context wrapper used by `nginx -t` in the repository.
- Create `deploy/nginx/README.md`: exact installation, validation, Certbot, and post-install verification procedure.
- Modify `README.md`: keep the root environment and port documentation consistent with staging.

### Task 1: Bind staging Docker upstreams to loopback

**Files:**

- Modify: `compose.yaml:108`
- Modify: `compose.yaml:137`
- Modify: `.env.staging.example:4-6`
- Modify: `.env.staging.example:40`
- Modify locally, never stage: `.env.staging:4-6`
- Modify locally, never stage: `.env.staging:40`

- [ ] **Step 1: Run failing assertions for the desired Compose and template values**

Run each command separately:

```bash
rg -qF '${HOST_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080}:8080' compose.yaml
rg -qF '${HOST_BIND_ADDRESS:-0.0.0.0}:${REVERB_HOST_PORT:-8081}:8000' compose.yaml
test "$(sed -n 's/^HOST_BIND_ADDRESS=//p' .env.staging.example)" = "127.0.0.1"
test "$(sed -n 's/^APP_PORT=//p' .env.staging.example)" = "7070"
test "$(sed -n 's/^REVERB_HOST_PORT=//p' .env.staging.example)" = "7071"
test "$(sed -n 's/^REVERB_PORT=//p' .env.staging.example)" = "443"
```

Expected: all six commands exit with status `1`. The repository still has the
old bind syntax and staging ports.

- [ ] **Step 2: Confirm `.env.staging` is ignored and fingerprint unaffected lines**

```bash
git check-ignore -q .env.staging
awk '!/^(HOST_BIND_ADDRESS|APP_PORT|REVERB_HOST_PORT|REVERB_PORT)=/' .env.staging | shasum -a 256
```

Expected: `git check-ignore` exits `0`. The second command prints a 64-character
SHA-256 digest. Retain that digest in the execution notes; it represents all
lines that this task is not authorized to change and reveals no values.

- [ ] **Step 3: Make the Compose host bind address configurable**

Apply this exact patch to `compose.yaml`:

```diff
 services:
   laravel:
     <<: *laravel-service
     ports:
-      - "${APP_PORT:-8080}:8080"
+      - "${HOST_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080}:8080"
@@
   reverb:
     <<: *laravel-service
@@
     ports:
-      - "${REVERB_HOST_PORT:-8081}:8000"
+      - "${HOST_BIND_ADDRESS:-0.0.0.0}:${REVERB_HOST_PORT:-8081}:8000"
```

The `0.0.0.0` default preserves the existing behavior in environments that do
not define `HOST_BIND_ADDRESS`.

- [ ] **Step 4: Update the versioned staging environment**

Apply these exact replacements to `.env.staging.example`:

```diff
 COMPOSE_PROJECT_NAME=pygeoapi-proxy-staging
 STACK_ENV=staging

-APP_PORT=8080
-REVERB_HOST_PORT=8081
+HOST_BIND_ADDRESS=127.0.0.1
+APP_PORT=7070
+REVERB_HOST_PORT=7071
```

```diff
 REVERB_APP_SECRET=change-this-staging-reverb-secret
 REVERB_HOST=proxygeoapi.netseven.work
-REVERB_PORT=8081
+REVERB_PORT=443
 REVERB_SCHEME=https
```

Do not change `APP_URL`, `REVERB_HOST`, `REVERB_SCHEME`, `SSL_MODE`, or any
credential value.

- [ ] **Step 5: Update only the authorized values in the ignored active environment**

Apply these exact structural changes to `.env.staging`:

```diff
 COMPOSE_PROJECT_NAME=pygeoapi-proxy-staging
 STACK_ENV=staging

-APP_PORT=8080
-REVERB_HOST_PORT=8081
+HOST_BIND_ADDRESS=127.0.0.1
+APP_PORT=7070
+REVERB_HOST_PORT=7071
```

```diff
 REVERB_HOST=proxygeoapi.netseven.work
-REVERB_PORT=8081
+REVERB_PORT=443
 REVERB_SCHEME=https
```

Use `apply_patch`; do not print, copy, regenerate, or stage `.env.staging`.

- [ ] **Step 6: Re-run the assertions and compare the active-file fingerprint**

```bash
rg -qF '${HOST_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080}:8080' compose.yaml
rg -qF '${HOST_BIND_ADDRESS:-0.0.0.0}:${REVERB_HOST_PORT:-8081}:8000' compose.yaml
test "$(sed -n 's/^HOST_BIND_ADDRESS=//p' .env.staging.example)" = "127.0.0.1"
test "$(sed -n 's/^APP_PORT=//p' .env.staging.example)" = "7070"
test "$(sed -n 's/^REVERB_HOST_PORT=//p' .env.staging.example)" = "7071"
test "$(sed -n 's/^REVERB_PORT=//p' .env.staging.example)" = "443"
test "$(sed -n 's/^HOST_BIND_ADDRESS=//p' .env.staging)" = "127.0.0.1"
test "$(sed -n 's/^APP_PORT=//p' .env.staging)" = "7070"
test "$(sed -n 's/^REVERB_HOST_PORT=//p' .env.staging)" = "7071"
test "$(sed -n 's/^REVERB_PORT=//p' .env.staging)" = "443"
awk '!/^(HOST_BIND_ADDRESS|APP_PORT|REVERB_HOST_PORT|REVERB_PORT)=/' .env.staging | shasum -a 256
```

Expected: the ten assertions exit `0`. The final digest is identical to the
digest from Step 2, proving every unauthorized line remained byte-for-byte
unchanged.

- [ ] **Step 7: Render and inspect only the safe port subset of Compose output**

```bash
make staging config >/dev/null
docker compose --env-file .env.staging -f compose.yaml -f compose.staging.yaml config --format json \
  | jq -r '[.services.laravel.ports[0], .services.reverb.ports[0]][] | "\(.host_ip):\(.published)->\(.target)"'
```

Expected output:

```text
127.0.0.1:7070->8080
127.0.0.1:7071->8000
```

The full rendered configuration is discarded or filtered because it contains
staging credentials.

- [ ] **Step 8: Commit the versioned port and bind changes**

```bash
git add compose.yaml .env.staging.example
git commit -m "Bind staging services behind host proxy"
```

Expected: the commit contains only the two Compose port expressions and the
four authorized staging-template changes. `.env.staging` remains ignored.

### Task 2: Add and validate the HTTP-only Nginx vhost

**Files:**

- Create: `deploy/nginx/tests/nginx.conf`
- Create: `deploy/nginx/proxygeoapi.netseven.work.conf`

- [ ] **Step 1: Add a minimal Nginx syntax-test harness**

Create the deployment test directory:

```bash
mkdir -p deploy/nginx/tests
```

Create `deploy/nginx/tests/nginx.conf` with exactly:

```nginx
worker_processes 1;
pid /tmp/pygeoapi-proxy-nginx-test.pid;
error_log stderr notice;

events {
    worker_connections 16;
}

http {
    access_log off;
    include deploy/nginx/proxygeoapi.netseven.work.conf;
}
```

- [ ] **Step 2: Run the harness and verify it fails because the vhost is absent**

```bash
nginx -t -p "$PWD/" -c deploy/nginx/tests/nginx.conf
```

Expected: exit status is non-zero and stderr reports that
`deploy/nginx/proxygeoapi.netseven.work.conf` cannot be opened.

- [ ] **Step 3: Add the HTTP-only Nginx vhost**

Create `deploy/nginx/proxygeoapi.netseven.work.conf` with exactly:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name proxygeoapi.netseven.work;

    client_max_body_size 100m;

    location ~ "^/apps?(?:/|$)" {
        proxy_pass http://127.0.0.1:7071;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:7070;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;

        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Do not add a `listen 443`, certificate path, or HTTP-to-HTTPS redirect. Certbot
adds those only after the HTTP vhost is installed on staging.

- [ ] **Step 4: Re-run the Nginx syntax test**

```bash
nginx -t -p "$PWD/" -c deploy/nginx/tests/nginx.conf
```

Expected: exit status `0`, with `syntax is ok` and `test is successful` on
stderr.

- [ ] **Step 5: Verify routing, WebSocket headers, and the HTTP-only boundary**

```bash
test "$(rg -cF 'proxy_pass http://127.0.0.1:7070;' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
test "$(rg -cF 'proxy_pass http://127.0.0.1:7071;' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
test "$(rg -cF 'location ~ "^/apps?(?:/|$)"' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
test "$(rg -cF 'proxy_set_header Upgrade $http_upgrade;' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
test "$(rg -cF 'proxy_set_header Connection "upgrade";' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
! rg -n 'listen .*443|ssl_certificate|return 30[18] https' deploy/nginx/proxygeoapi.netseven.work.conf
```

Expected: every command exits `0`; the final command prints nothing.

- [ ] **Step 6: Commit the vhost and test harness**

```bash
git add deploy/nginx/proxygeoapi.netseven.work.conf deploy/nginx/tests/nginx.conf
git commit -m "Add staging Nginx reverse proxy"
```

Expected: one commit containing only the HTTP bootstrap vhost and its syntax
test harness.

### Task 3: Document bootstrap, Certbot, and staging ports

**Files:**

- Create: `deploy/nginx/README.md`
- Modify: `README.md:52-58`
- Modify: `README.md:149-158`
- Modify: `README.md:328-341`

- [ ] **Step 1: Run assertions that demonstrate deployment documentation is absent**

```bash
test -f deploy/nginx/README.md
rg -q '127\.0\.0\.1:7070' README.md
rg -q '127\.0\.0\.1:7071' README.md
```

Expected: all three commands exit with status `1`.

- [ ] **Step 2: Add the host-Nginx deployment guide**

Create `deploy/nginx/README.md` with exactly:

````markdown
# Staging Nginx reverse proxy

This directory contains the initial HTTP-only host configuration for
`proxygeoapi.netseven.work`. Docker publishes Laravel on `127.0.0.1:7070` and
Reverb on `127.0.0.1:7071`; neither port should be reachable from outside the
staging host.

The repository is installed at:

```text
/docker-data/configuration/pygeoapi-proxy/proxy
```

## 1. Start the staging stack

```bash
cd /docker-data/configuration/pygeoapi-proxy/proxy
make staging config >/dev/null
make staging up
curl --fail --silent --show-error http://127.0.0.1:7070/up >/dev/null
```

The Reverb process must also be healthy:

```bash
docker compose --env-file .env.staging -f compose.yaml -f compose.staging.yaml ps reverb
```

## 2. Install the HTTP bootstrap vhost

The host Nginx configuration must include `/etc/nginx/conf.d/*.conf`.

```bash
sudo install -m 0644 \
  deploy/nginx/proxygeoapi.netseven.work.conf \
  /etc/nginx/conf.d/proxygeoapi.netseven.work.conf
sudo nginx -t
sudo systemctl reload nginx
curl --fail --head http://proxygeoapi.netseven.work
```

At this stage Nginx listens only on port `80`. Do not add certificate paths to
the repository vhost.

## 3. Issue and install the first certificate

Back up the installed Nginx configuration, then let Certbot obtain the
certificate, add the TLS listener, and enable the HTTP-to-HTTPS redirect:

```bash
sudo cp \
  /etc/nginx/conf.d/proxygeoapi.netseven.work.conf \
  /etc/nginx/conf.d/proxygeoapi.netseven.work.conf.before-certbot
sudo certbot --nginx -d proxygeoapi.netseven.work --redirect
sudo nginx -t
sudo systemctl reload nginx
curl --fail --head https://proxygeoapi.netseven.work
```

Certbot modifies the installed copy under `/etc/nginx/conf.d`; the repository
file remains an HTTP-only bootstrap template. Do not overwrite the installed
file with the repository template after Certbot without first preserving the
generated TLS directives.

## 4. Verify routing

```bash
curl --fail --silent --show-error https://proxygeoapi.netseven.work/up >/dev/null
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://proxygeoapi.netseven.work/app/invalid
```

The first command must exit `0`. The second command may return an application
error for the invalid Reverb key, but it must not return `000` or `502`; either
value indicates that Nginx cannot reach Reverb on `127.0.0.1:7071`.

Public endpoints after Certbot:

```text
Application: https://proxygeoapi.netseven.work
Reverb:     wss://proxygeoapi.netseven.work/app/...
```

Useful logs:

```bash
sudo journalctl -u nginx --since '10 minutes ago'
docker compose --env-file .env.staging -f compose.yaml -f compose.staging.yaml logs --tail=100 laravel reverb
```
````

- [ ] **Step 3: Update the root service-port documentation**

Apply this exact patch to `README.md`:

```diff
-- `laravel`: applicazione Laravel pubblica sulla porta host `${APP_PORT:-8088}`
-  in `develop` e `${APP_PORT:-8080}` negli altri ambienti.
+- `laravel`: applicazione Laravel pubblica sulla porta host `${APP_PORT:-8088}`
+  in `develop`, su `127.0.0.1:7070` in `staging` e su `${APP_PORT:-8080}` in
+  `production`.
@@
-- `reverb`: WebSocket server Laravel Reverb, pubblicato su
-  `${REVERB_HOST_PORT:-8089}` in `develop` e `${REVERB_HOST_PORT:-8081}`
-  negli altri ambienti.
+- `reverb`: WebSocket server Laravel Reverb, pubblicato su
+  `${REVERB_HOST_PORT:-8089}` in `develop`, su `127.0.0.1:7071` in `staging`
+  e su `${REVERB_HOST_PORT:-8081}` in `production`.
```

- [ ] **Step 4: Document the staging variables that control the host proxy**

Insert this paragraph immediately after the existing environment-variable list:

```markdown

Il template `staging` preconfigura inoltre `HOST_BIND_ADDRESS=127.0.0.1`,
`APP_PORT=7070`, `REVERB_HOST_PORT=7071` e `REVERB_PORT=443` per l'Nginx host.
Questi valori non sono i default di `develop` o `production`.
```

- [ ] **Step 5: Replace the generic staging exposure note and add the Nginx files**

Apply this exact patch to `README.md`:

```diff
-In `staging` e `production`, Laravel e Reverb restano esposti sulle porte
-configurate, mentre pygeoapi resta solo interno al network Docker.
+In `staging`, Laravel e Reverb sono raggiungibili soltanto dall'host su
+`127.0.0.1:7070` e `127.0.0.1:7071`; l'Nginx host pubblica applicazione e
+WebSocket sul dominio `proxygeoapi.netseven.work`. In `production` le porte
+restano configurabili normalmente. Pygeoapi resta interno al network Docker.
+La procedura staging completa è in `deploy/nginx/README.md`.
@@
 - `Makefile`: comandi rapidi.
 - `.env.*.example`: template env per ambiente.
+- `deploy/nginx/proxygeoapi.netseven.work.conf`: vhost HTTP iniziale staging.
+- `deploy/nginx/README.md`: installazione Nginx e bootstrap Certbot.
```

- [ ] **Step 6: Verify documentation contains the exact operational contract**

```bash
test -f deploy/nginx/README.md
rg -q '127\.0\.0\.1:7070' README.md deploy/nginx/README.md
rg -q '127\.0\.0\.1:7071' README.md deploy/nginx/README.md
rg -qF 'sudo certbot --nginx -d proxygeoapi.netseven.work --redirect' deploy/nginx/README.md
rg -qF '/docker-data/configuration/pygeoapi-proxy/proxy' deploy/nginx/README.md
```

Expected: all five commands exit `0`.

- [ ] **Step 7: Commit deployment documentation**

```bash
git add README.md deploy/nginx/README.md
git commit -m "Document staging Nginx bootstrap"
```

Expected: one commit containing only the host deployment guide and root README
updates.

### Task 4: Run final repository verification

**Files:**

- Verify: `compose.yaml`
- Verify: `.env.staging.example`
- Verify locally: `.env.staging`
- Verify: `deploy/nginx/proxygeoapi.netseven.work.conf`
- Verify: `deploy/nginx/tests/nginx.conf`
- Verify: `deploy/nginx/README.md`
- Verify: `README.md`

- [ ] **Step 1: Re-run the Nginx syntax and semantic checks**

```bash
nginx -t -p "$PWD/" -c deploy/nginx/tests/nginx.conf
test "$(rg -cF 'proxy_pass http://127.0.0.1:7070;' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
test "$(rg -cF 'proxy_pass http://127.0.0.1:7071;' deploy/nginx/proxygeoapi.netseven.work.conf)" = "1"
! rg -n 'listen .*443|ssl_certificate|return 30[18] https' deploy/nginx/proxygeoapi.netseven.work.conf
```

Expected: Nginx reports a successful configuration test; all assertions exit
`0`; no TLS directive is printed.

- [ ] **Step 2: Re-render Compose and verify the public/private port distinction**

```bash
make staging config >/dev/null
docker compose --env-file .env.staging -f compose.yaml -f compose.staging.yaml config --format json \
  | jq -r '[.services.laravel.ports[0], .services.reverb.ports[0]][] | "\(.host_ip):\(.published)->\(.target)"'
rg -n '^(HOST_BIND_ADDRESS|APP_PORT|REVERB_HOST_PORT|APP_URL|REVERB_HOST|REVERB_PORT|REVERB_SCHEME|SSL_MODE)=' .env.staging
```

Expected safe output:

```text
127.0.0.1:7070->8080
127.0.0.1:7071->8000
4:HOST_BIND_ADDRESS=127.0.0.1
5:APP_PORT=7070
6:REVERB_HOST_PORT=7071
12:APP_URL=https://proxygeoapi.netseven.work
40:REVERB_HOST=proxygeoapi.netseven.work
41:REVERB_PORT=443
42:REVERB_SCHEME=https
59:SSL_MODE=off
```

Line numbers reflect the single new `HOST_BIND_ADDRESS` entry. If unrelated
lines are inserted during execution, compare values rather than line numbers.

- [ ] **Step 3: Verify repository hygiene and ignored-secret handling**

```bash
git check-ignore -q .env.staging
git diff -- .env.staging
git diff --check
git status --short --branch
```

Expected: `.env.staging` is ignored; it has no Git diff; `git diff --check`
prints nothing; the branch has no uncommitted tracked files.

- [ ] **Step 4: Record the deployment boundary in the handoff**

Report these repository-configured endpoints:

```text
Docker Laravel: 127.0.0.1:7070
Docker Reverb:  127.0.0.1:7071
Public app:     https://proxygeoapi.netseven.work
Public Reverb:  wss://proxygeoapi.netseven.work/app/...
```

State explicitly that no command was executed on staging, no certificate was
issued, and the initial repository vhost remains HTTP-only until the documented
Certbot procedure is run on the host.
