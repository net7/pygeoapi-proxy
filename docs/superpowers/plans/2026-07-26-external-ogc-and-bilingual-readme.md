# External OGC Service and Bilingual README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local pygeoapi runtime, configure proxygeoapi for the
remote OGC Processes endpoint, correct all active deployment documentation, and
finish the bilingual project README with the blue Figlet wordmark and precise
technology stack.

**Architecture:** Docker Compose owns Laravel, Horizon, scheduler, Reverb,
MariaDB, Redis, GeoServer, and the development utilities. Laravel and its worker
roles consume the remote OGC Processes API through
`OGC_PROCESSES_BASE_URL`; no local pygeoapi image, service, port, health check,
or dependency remains. The root READMEs summarize the proxy workflow and defer
operations detail to the bilingual deployment guides.

**Tech Stack:** Docker Compose, POSIX shell, Make, Laravel 13, React 19,
Inertia 3, Redis/Horizon, MariaDB, GeoServer, GitLab CI, Markdown, SVG.

## Global Constraints

- The default OGC Processes endpoint is exactly
  `https://voice.pi.ingv.it/geoinquire/`.
- Deployments can override the endpoint only through
  `OGC_PROCESSES_BASE_URL`.
- Do not build, start, expose, health-check, or depend on a local pygeoapi
  container.
- Delete the root `Dockerfile`, `entrypoint.sh`, and `my.config.yml`; they are
  obsolete local pygeoapi runtime assets.
- Keep GeoServer in the Compose stack.
- Keep application and database identifiers such as `pygeoapi_proxy`.
- Keep historical documents below `docs/superpowers/` and
  `proxy/docs/superpowers/` unchanged.
- Keep English and Italian active documentation equivalent.
- Use `proxygeoapi` as the formal wordmark text, generated in Figlet `slant`
  style and colored `#2563EB`.
- The wordmark SVG is the first rendered element in both root READMEs.
- Process status updates are described as browser polling of Laravel HTTP
  endpoints, not Reverb events.
- Execute in the current checkout, inline, without a worktree.

## File Structure

- Create `deploy/tests/compose-external-ogc.sh`: Compose and environment
  regression contract for the remote OGC Processes service.
- Modify `deploy/tests/run.sh`: include the new Compose and README contracts.
- Modify `deploy/tests/makefile-deploy.sh`: require the deployment build to
  build only the Laravel image.
- Modify `compose.yaml`: propagate `OGC_PROCESSES_BASE_URL`, remove the local
  service and Laravel dependency.
- Modify `compose.develop.yaml`: remove the development pygeoapi port override.
- Modify `.env.develop.example`, `.env.staging.example`, and
  `.env.production.example`: expose the remote endpoint variable and remove
  legacy local-container variables.
- Modify `Makefile`: remove local pygeoapi build and validation behavior.
- Delete `Dockerfile`, `entrypoint.sh`, and `my.config.yml`: remove the bundled
  pygeoapi runtime.
- Modify `deploy/tests/bootstrap-runbook.sh`: enforce the external-service
  deployment documentation contract.
- Modify `DEPLOY.md` and `DEPLOY.it.md`: describe deployment and operations
  without a local pygeoapi service.
- Modify `PYGEOAPI.md`: retain the API reference while making examples use the
  configurable remote endpoint.
- Create `deploy/tests/readme.sh`: enforce bilingual README structure, links,
  stack versions, wordmark color, and absence of local pygeoapi instructions.
- Create `docs/assets/proxygeoapi-wordmark.svg`: shared accessible blue Figlet
  wordmark.
- Rewrite `README.md`: concise English project overview.
- Create `README.it.md`: equivalent Italian project overview.

---

### Task 1: Replace the local pygeoapi runtime with an external endpoint

**Files:**

- Create: `deploy/tests/compose-external-ogc.sh`
- Modify: `deploy/tests/run.sh`
- Modify: `deploy/tests/makefile-deploy.sh`
- Modify: `compose.yaml`
- Modify: `compose.develop.yaml`
- Modify: `.env.develop.example`
- Modify: `.env.staging.example`
- Modify: `.env.production.example`
- Modify: `Makefile`
- Delete: `Dockerfile`
- Delete: `entrypoint.sh`
- Delete: `my.config.yml`

**Interfaces:**

- Consumes: Laravel's existing
  `config('services.ogc_processes.base_url')` configuration and the common
  `x-laravel-environment` Compose anchor.
- Produces: `OGC_PROCESSES_BASE_URL` in the `laravel`, `horizon`, `scheduler`,
  and `reverb` environments; a Compose stack with no `pygeoapi` service.

- [ ] **Step 1: Add the failing external-service Compose contract**

Create `deploy/tests/compose-external-ogc.sh`:

```sh
#!/bin/sh

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
rendered_config=$(mktemp)
trap 'rm -f "$rendered_config"' EXIT HUP INT TERM

cd "$repository_root"

expected_endpoint=https://voice.pi.ingv.it/geoinquire/

for environment in develop staging production; do
    environment_file=".env.${environment}.example"

    if ! grep -Fx "OGC_PROCESSES_BASE_URL=$expected_endpoint" \
        "$environment_file" > /dev/null; then
        printf 'Missing remote OGC endpoint in %s\n' "$environment_file" >&2
        exit 1
    fi

    if grep -E '^(PYGEOAPI_BASE_URL|PYGEOAPI_SERVER_URL|PYGEOAPI_PORT)=' \
        "$environment_file" > /dev/null; then
        printf 'Legacy pygeoapi setting remains in %s\n' \
            "$environment_file" >&2
        exit 1
    fi

    docker compose \
        --env-file "$environment_file" \
        -f compose.yaml \
        -f "compose.${environment}.yaml" \
        config --format json > "$rendered_config"

    jq -e --arg endpoint "$expected_endpoint" '
        . as $config |
        ($config.services | has("pygeoapi") | not) and
        (["laravel", "horizon", "scheduler", "reverb"] |
            all(. as $service |
                $config.services[$service].environment.OGC_PROCESSES_BASE_URL
                    == $endpoint and
                ($config.services[$service].depends_on |
                    has("pygeoapi") | not)
            )
        )
    ' "$rendered_config" > /dev/null
done

for obsolete_file in Dockerfile entrypoint.sh my.config.yml; do
    if [ -e "$obsolete_file" ]; then
        printf 'Obsolete local pygeoapi file remains: %s\n' \
            "$obsolete_file" >&2
        exit 1
    fi
done
```

Make it executable and add `compose-external-ogc.sh` immediately after
`compose-oauth-env.sh` in the loop in `deploy/tests/run.sh`.

- [ ] **Step 2: Change the Make deployment contract before the implementation**

In `deploy/tests/makefile-deploy.sh`, replace:

```sh
"$compose_prefix build --pull laravel pygeoapi" \
```

with:

```sh
"$compose_prefix build --pull laravel" \
```

- [ ] **Step 3: Run the focused tests and verify the expected failures**

Run:

```bash
deploy/tests/compose-external-ogc.sh
deploy/tests/makefile-deploy.sh
```

Expected:

- the Compose contract fails because the environment examples do not contain
  `OGC_PROCESSES_BASE_URL`;
- the Make contract fails because `deploy-build` still invokes
  `build --pull laravel pygeoapi`.

- [ ] **Step 4: Implement the external endpoint configuration**

In `compose.yaml`, replace the legacy application environment entry with:

```yaml
  OGC_PROCESSES_BASE_URL: ${OGC_PROCESSES_BASE_URL:-https://voice.pi.ingv.it/geoinquire/}
```

Remove this dependency from `x-laravel-service`:

```yaml
    pygeoapi:
      condition: service_healthy
```

Delete the complete `services.pygeoapi` mapping from `compose.yaml` and the
complete `services.pygeoapi` override from `compose.develop.yaml`.

In each `.env.<environment>.example`, replace every `PYGEOAPI_*` assignment
with this single line:

```dotenv
OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
```

In `Makefile`:

- remove `pygeoapi-validate` from `.PHONY`;
- remove its help line;
- change `deploy-build` to:

  ```make
  deploy-build: require-env
	BUILDKIT_PROGRESS=$(DEPLOY_BUILD_PROGRESS) $(COMPOSE) build --pull laravel
  ```

- delete the `pygeoapi-validate` target.

Delete the root `Dockerfile`, `entrypoint.sh`, and `my.config.yml`. These three
deletions are explicitly authorized and are recoverable from Git history.

- [ ] **Step 5: Verify all Compose environments and deployment commands**

Run:

```bash
deploy/tests/compose-external-ogc.sh
deploy/tests/makefile-deploy.sh
docker compose --env-file .env.develop.example \
  -f compose.yaml -f compose.develop.yaml config --quiet
docker compose --env-file .env.staging.example \
  -f compose.yaml -f compose.staging.yaml config --quiet
docker compose --env-file .env.production.example \
  -f compose.yaml -f compose.production.yaml config --quiet
```

Expected: every command exits `0`.

- [ ] **Step 6: Review and commit the runtime removal**

Run:

```bash
git diff --check
git status --short
git diff -- compose.yaml compose.develop.yaml \
  .env.develop.example .env.staging.example .env.production.example \
  Makefile deploy/tests/run.sh deploy/tests/compose-external-ogc.sh \
  deploy/tests/makefile-deploy.sh Dockerfile entrypoint.sh my.config.yml
```

Confirm that no `pygeoapi` Compose service or legacy `PYGEOAPI_*` setting
remains, then commit:

```bash
git add compose.yaml compose.develop.yaml \
  .env.develop.example .env.staging.example .env.production.example \
  Makefile deploy/tests/run.sh deploy/tests/compose-external-ogc.sh \
  deploy/tests/makefile-deploy.sh Dockerfile entrypoint.sh my.config.yml
git commit -m "fix: use external OGC processes service"
```

### Task 2: Correct the deployment and pygeoapi API documentation

**Files:**

- Modify: `deploy/tests/bootstrap-runbook.sh`
- Modify: `DEPLOY.md`
- Modify: `DEPLOY.it.md`
- Modify: `PYGEOAPI.md`
- Preserve: `deploy/README.md`
- Preserve: `deploy/nginx/README.md`

**Interfaces:**

- Consumes: the `OGC_PROCESSES_BASE_URL` contract from Task 1 and the
  previously verified GitLab pipeline/job information already documented in
  the deployment guides.
- Produces: active English and Italian operations guides that treat pygeoapi
  as a remote dependency; an API reference whose examples target the
  configurable endpoint.

- [ ] **Step 1: Extend the documentation contract before editing the guides**

In `deploy/tests/bootstrap-runbook.sh`, add:

```sh
api_reference="$repository_root/PYGEOAPI.md"
```

Add this helper after `require_text`:

```sh
require_absent_text() {
    file=$1
    text=$2
    if grep -F -- "$text" "$file" > /dev/null; then
        printf 'Obsolete deployment documentation in %s: %s\n' \
            "$file" "$text" >&2
        exit 1
    fi
}
```

Require the API reference file:

```sh
require_file "$api_reference"
```

After the existing bilingual runbook checks, add:

```sh
for document in "$english_runbook" "$italian_runbook" "$api_reference"; do
    require_text "$document" 'https://voice.pi.ingv.it/geoinquire/'
    require_text "$document" 'OGC_PROCESSES_BASE_URL'

    for obsolete_text in \
        'http://pygeoapi' \
        'localhost:5000' \
        'PYGEOAPI_BASE_URL' \
        'PYGEOAPI_SERVER_URL' \
        'PYGEOAPI_PORT' \
        'make pygeoapi-validate' \
        'geopython/pygeoapi:latest'
    do
        require_absent_text "$document" "$obsolete_text"
    done
done
```

- [ ] **Step 2: Run the contract and verify it fails on local assumptions**

Run:

```bash
sh deploy/tests/bootstrap-runbook.sh
```

Expected: FAIL because the current guides still contain local pygeoapi service
instructions.

- [ ] **Step 3: Update the English and Italian deployment guides**

Keep the existing deployment, GitLab pipeline, bootstrap, rollback, Nginx,
security, and troubleshooting coverage. Make these exact architectural
corrections in both guides:

- remove the development port `5000` from environment and URL tables;
- remove `pygeoapi` from every Compose service, network, build, health-check,
  log, startup, and dependency list;
- remove the root `Dockerfile`, `entrypoint.sh`, and `my.config.yml` from
  prerequisites and file maps;
- state that the repository proxies a separately operated remote pygeoapi/OGC
  Processes service;
- list the local stack as Laravel, Horizon, scheduler, Reverb, MariaDB, Redis,
  GeoServer, and development-only Vite, phpMyAdmin, and Mailpit;
- state that `make <environment> deploy-build` builds only the Laravel image;
- retain the GitLab pipeline description based on the configured project:
  `deployment-check`, `php-check`, `frontend-check`, then
  `deploy:staging` on the protected `staging` branch;
- document this required/default environment value:

  ```dotenv
  OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
  ```

- add a remote connectivity diagnostic:

  ```bash
  OGC_PROCESSES_BASE_URL=https://voice.pi.ingv.it/geoinquire/
  curl --fail --silent --show-error \
    "${OGC_PROCESSES_BASE_URL%/}/processes?f=json" > /dev/null
  ```

- explain that network, TLS, authentication, timeout, or upstream availability
  failures are remote dependency failures; operators should inspect Laravel
  and Horizon logs and verify the endpoint from the deployment host;
- do not claim that this repository controls the remote pygeoapi version.

Use equivalent English prose in `DEPLOY.md` and Italian prose in
`DEPLOY.it.md`. Keep commands, filenames, service names, variables, and URLs
identical.

- [ ] **Step 4: Correct the API reference examples**

Keep the complete route catalogue in `PYGEOAPI.md`. In the introduction, add
that it documents the external service consumed by proxygeoapi and that the
remote deployment/configuration is managed outside this repository.

Replace the quick-example base URL with:

```bash
BASE_URL=${OGC_PROCESSES_BASE_URL:-https://voice.pi.ingv.it/geoinquire/}
BASE_URL=${BASE_URL%/}
```

Ensure all examples continue to concatenate paths as
`"$BASE_URL/processes"`, `"$BASE_URL/jobs"`, and so on, without producing
double slashes. Remove all bundled-container and localhost assumptions while
retaining upstream implementation and version-reference notes.

- [ ] **Step 5: Verify and commit the active guide corrections**

Run:

```bash
sh deploy/tests/bootstrap-runbook.sh
git diff --check
git diff -- DEPLOY.md DEPLOY.it.md PYGEOAPI.md \
  deploy/tests/bootstrap-runbook.sh
```

Expected: the contract and whitespace check exit `0`, and the diff contains no
instructions for a local pygeoapi runtime.

Commit:

```bash
git add DEPLOY.md DEPLOY.it.md PYGEOAPI.md \
  deploy/tests/bootstrap-runbook.sh
git commit -m "docs: document external OGC processes service"
```

### Task 3: Add the blue wordmark and bilingual project overview

**Files:**

- Create: `deploy/tests/readme.sh`
- Modify: `deploy/tests/run.sh`
- Create: `docs/assets/proxygeoapi-wordmark.svg`
- Rewrite: `README.md`
- Create: `README.it.md`

**Interfaces:**

- Consumes: the corrected deployment links and external endpoint terminology
  from Task 2, plus the application/package versions already verified from
  `proxy/composer.lock`, `proxy/bun.lock`, `proxy/Dockerfile`,
  `compose.yaml`, and `.gitlab-ci.yml`.
- Produces: concise bilingual entry points and a shared accessible SVG
  wordmark.

- [ ] **Step 1: Add the failing bilingual README contract**

Create `deploy/tests/readme.sh`:

```sh
#!/bin/sh

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
english_readme="$repository_root/README.md"
italian_readme="$repository_root/README.it.md"
wordmark="$repository_root/docs/assets/proxygeoapi-wordmark.svg"

require_file() {
    if [ ! -f "$1" ]; then
        printf 'Required README asset does not exist: %s\n' "$1" >&2
        exit 1
    fi
}

require_text() {
    if ! grep -F -- "$2" "$1" > /dev/null; then
        printf 'Missing README contract in %s: %s\n' "$1" "$2" >&2
        exit 1
    fi
}

require_absent_text() {
    if grep -F -- "$2" "$1" > /dev/null; then
        printf 'Obsolete README content in %s: %s\n' "$1" "$2" >&2
        exit 1
    fi
}

require_file "$english_readme"
require_file "$italian_readme"
require_file "$wordmark"

first_line='![proxygeoapi](docs/assets/proxygeoapi-wordmark.svg)'
test "$(sed -n '1p' "$english_readme")" = "$first_line"
test "$(sed -n '1p' "$italian_readme")" = "$first_line"

require_text "$wordmark" 'fill="#2563EB"'
require_text "$wordmark" 'Figlet slant'

require_text "$english_readme" '[Italiano](README.it.md)'
require_text "$italian_readme" '[English](README.md)'
require_text "$english_readme" '[DEPLOY.md](DEPLOY.md)'
require_text "$italian_readme" '[DEPLOY.it.md](DEPLOY.it.md)'

for document in "$english_readme" "$italian_readme"; do
    require_text "$document" 'OGC_PROCESSES_BASE_URL'
    require_text "$document" 'https://voice.pi.ingv.it/geoinquire/'

    for version in \
        13.22.0 3.1.1 1.37.3 5.29.0 4.1.0 0.2.0 \
        5.48.1 1.11.0 19.2.8 3.6.1 5.9.3 4.3.3 \
        2.2.10 0.475.0 5.3.0 8.17.1 8.21.3 \
        2.0.0-alpha.43 3.29.0 5.24.0 4.5.1 2.27.1 \
        8.1.5 1.3.14
    do
        require_text "$document" "$version"
    done

    for obsolete_text in \
        'http://pygeoapi' \
        'localhost:5000' \
        'PYGEOAPI_BASE_URL' \
        'PYGEOAPI_SERVER_URL' \
        'PYGEOAPI_PORT' \
        'make pygeoapi-validate' \
        'geopython/pygeoapi:latest'
    do
        require_absent_text "$document" "$obsolete_text"
    done
done
```

Make it executable and add `readme.sh` immediately before `gitlab-ci.sh` in
`deploy/tests/run.sh`.

- [ ] **Step 2: Run the README contract and verify the expected failure**

Run:

```bash
deploy/tests/readme.sh
```

Expected: FAIL because `README.it.md` and the wordmark do not exist.

- [ ] **Step 3: Create the blue Figlet SVG wordmark**

Create `docs/assets/proxygeoapi-wordmark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 130"
     role="img" aria-labelledby="title description">
  <title id="title">proxygeoapi</title>
  <desc id="description">
    The proxygeoapi wordmark in the Figlet slant style.
  </desc>
  <g fill="#2563EB" font-family="'Courier New', Courier, monospace"
     font-size="16" font-weight="700" xml:space="preserve">
    <text x="0" y="20">                                                              _</text>
    <text x="0" y="40">    ____  _________  _  ____  ______ ____  ____  ____ _____  (_)</text>
    <text x="0" y="60">   / __ \/ ___/ __ \| |/_/ / / / __ `/ _ \/ __ \/ __ `/ __ \/ /</text>
    <text x="0" y="80">  / /_/ / /  / /_/ />  &lt;/ /_/ / /_/ /  __/ /_/ / /_/ / /_/ / /</text>
    <text x="0" y="100"> / .___/_/   \____/_/|_|\__, /\__, /\___/\____/\__,_/ .___/_/</text>
    <text x="0" y="120">/_/                    /____//____/                /_/</text>
  </g>
</svg>
```

Keep the background transparent and do not add inline CSS or raster variants.

- [ ] **Step 4: Rewrite the English README**

The first line must be:

```markdown
![proxygeoapi](docs/assets/proxygeoapi-wordmark.svg)
```

Follow it with `[Italiano](README.it.md)`, then these sections:

```markdown
# proxygeoapi
## What it does
## Highlights
## How it works
## Architecture
## Technology stack
## Quick start
## Deployment
## Documentation map
```

Keep the overview concise and state:

- authenticated users browse cached OGC processes and receive dynamic forms
  generated from process schemas;
- browser and Laravel validation precede persisted, queued, asynchronous
  executions handled by Horizon;
- the browser polls Laravel HTTP endpoints for status and job history persists;
- results support structured JSON, CSV previews, charts, and GeoTIFF/SLD map
  layers through GeoServer;
- authentication supports configured social providers and email OTP, and
  administrators manage users and jobs;
- the interface supports English and Italian;
- the OGC backend is the remote endpoint configured by
  `OGC_PROCESSES_BASE_URL`, defaulting to
  `https://voice.pi.ingv.it/geoinquire/`;
- the external pygeoapi version and deployment are managed outside this
  repository.

Use this compact flow:

```text
Browser -> Laravel/Inertia -> Redis/Horizon -> external pygeoapi
   ^             |                                  |
   |          MariaDB <---- execution status/results+
   |
   +---------- HTTP status polling and previews via Laravel/GeoServer
```

Include this exact stack inventory, making pinned and floating versions
explicit:

| Area | Technologies and current versions |
| --- | --- |
| Runtime | PHP `8.5` on `serversideup/php:8.5-fpm-nginx`; bundled Nginx |
| Backend | Laravel `13.22.0`; Inertia Laravel `3.1.1` |
| Authentication | Fortify `1.37.3`; Socialite `5.29.0`; Google provider `4.1.0`; custom ORCID OAuth and email OTP; Laravel Passkeys JS `0.2.0` |
| Async and realtime | Horizon `5.48.1`; Reverb `1.11.0`; Redis `alpine` (floating tag) |
| Frontend | React and React DOM `19.2.8`; Inertia React `3.6.1`; TypeScript `5.9.3` |
| UI | Tailwind CSS `4.3.3`; Headless UI `2.2.10`; Radix UI primitives locked individually in `bun.lock`; Lucide React `0.475.0`; Roboto Mono `5.3.0` |
| Validation and data | AJV `8.17.1`; TanStack React Table `8.21.3`; JSON View `2.0.0-alpha.43`; Tiptap `3.29.0` |
| Maps and charts | MapLibre GL `5.24.0`; Chart.js `4.5.1`; GeoServer `2.27.1` |
| OGC processing | Remote pygeoapi / OGC API - Processes; endpoint configured with `OGC_PROCESSES_BASE_URL`; upstream version managed externally |
| Persistence | MariaDB `latest` (floating tag); Redis `alpine` (floating tag) |
| Build | Vite `8.1.5`; Bun `latest` in the application image and `1.3.14` in CI; Node `latest` in the application image |
| Containers and CI | Docker Compose; GitLab CI; Docker CLI `29`; Composer `2`; Alpine `3.24` deploy image |
| Development only | Vite dev server; phpMyAdmin `latest`; Mailpit `latest` |

Use this quick start:

```bash
make env
make up
```

Summarize only the local application and supporting-service URLs. Link
prominently to `[DEPLOY.md](DEPLOY.md)` for full deployment instructions and
also link `README.it.md`, `DEPLOY.it.md`, `PYGEOAPI.md`, and
`deploy/nginx/README.md`.

- [ ] **Step 5: Create the equivalent Italian README**

Use the same image as the first line, followed by `[English](README.md)`, then:

```markdown
# proxygeoapi
## Cosa fa
## Funzionalità principali
## Come funziona
## Architettura
## Stack tecnologico
## Avvio rapido
## Deploy
## Mappa della documentazione
```

Mirror every English fact, version, link, command, and architecture boundary.
Translate explanatory prose and table labels only. Use
`[DEPLOY.it.md](DEPLOY.it.md)` as the primary deployment link.

- [ ] **Step 6: Verify wordmark, parity, links, and the full deployment suite**

Run:

```bash
deploy/tests/readme.sh
sh deploy/tests/bootstrap-runbook.sh
deploy/tests/run.sh
git diff --check
```

Verify that the SVG text matches Figlet `slant` output and the approved blue:

```bash
python3 - <<'PY'
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

path = Path("docs/assets/proxygeoapi-wordmark.svg")
root = ET.parse(path).getroot()
namespace = {"svg": "http://www.w3.org/2000/svg"}
group = root.find("svg:g", namespace)
if group is None:
    raise SystemExit("Missing SVG wordmark group")

if group.attrib.get("fill", "").upper() != "#2563EB":
    raise SystemExit("Unexpected wordmark color")

actual = [
    (node.text or "").rstrip()
    for node in group.findall("svg:text", namespace)
]
expected = [
    line.rstrip()
    for line in subprocess.check_output(
        ["figlet", "-f", "slant", "proxygeoapi"],
        text=True,
    ).splitlines()
]
if actual != expected:
    raise SystemExit("SVG text does not match Figlet slant output")

print("Wordmark matches Figlet slant output and approved blue.")
PY
```

Verify all relative documentation links:

```bash
python3 - <<'PY'
from pathlib import Path
import re

documents = [
    Path("README.md"),
    Path("README.it.md"),
    Path("DEPLOY.md"),
    Path("DEPLOY.it.md"),
    Path("deploy/README.md"),
]

missing = []
for document in documents:
    for target in re.findall(r"\]\(([^)]+)\)", document.read_text()):
        path = target.split("#", 1)[0]
        if not path or "://" in path or path.startswith("mailto:"):
            continue
        resolved = (document.parent / path).resolve()
        if not resolved.exists():
            missing.append(f"{document}: {target}")

if missing:
    raise SystemExit("Missing relative links:\n" + "\n".join(missing))

print("All relative documentation links resolve.")
PY
```

Run ShellCheck using the installed binary, or the transient Alpine container
when it is not installed locally:

```bash
shellcheck deploy.sh deploy/tests/*.sh
```

Container fallback:

```bash
docker run --rm \
  -v "$PWD:/work" \
  -w /work \
  alpine:3.24 \
  sh -lc 'apk add --no-cache shellcheck >/dev/null && shellcheck deploy.sh deploy/tests/*.sh'
```

Expected: every check exits `0`; the deployment suite prints
`All deployment tests passed.`, the SVG verifier confirms the Figlet output,
and the link checker reports no missing targets.

- [ ] **Step 7: Review and commit the project overview**

Run:

```bash
git status --short
git diff --stat
git diff -- README.md README.it.md \
  docs/assets/proxygeoapi-wordmark.svg deploy/tests/readme.sh \
  deploy/tests/run.sh
```

Commit:

```bash
git add README.md README.it.md docs/assets/proxygeoapi-wordmark.svg \
  deploy/tests/readme.sh deploy/tests/run.sh
git commit -m "docs: add bilingual project overview"
```

### Task 4: Final scope and repository verification

**Files:**

- Verify: all files changed by Tasks 1–3
- Preserve: historical documents under `docs/superpowers/` and
  `proxy/docs/superpowers/`

**Interfaces:**

- Consumes: the complete implementation from Tasks 1–3.
- Produces: a clean, reviewable branch whose active configuration and
  documentation agree.

- [ ] **Step 1: Scan active files for obsolete local-runtime references**

Run:

```bash
rg -n \
  'http://pygeoapi|localhost:5000|PYGEOAPI_BASE_URL|PYGEOAPI_SERVER_URL|PYGEOAPI_PORT|pygeoapi-validate|geopython/pygeoapi:latest' \
  README.md README.it.md DEPLOY.md DEPLOY.it.md PYGEOAPI.md \
  compose*.yaml .env.*.example Makefile deploy deploy.sh .gitlab-ci.yml
```

Expected: no matches. Matches under historical `docs/superpowers/` paths are
outside this check and remain untouched.

- [ ] **Step 2: Run final configuration and test verification**

Run:

```bash
docker compose --env-file .env.develop.example \
  -f compose.yaml -f compose.develop.yaml config --quiet
docker compose --env-file .env.staging.example \
  -f compose.yaml -f compose.staging.yaml config --quiet
docker compose --env-file .env.production.example \
  -f compose.yaml -f compose.production.yaml config --quiet
deploy/tests/run.sh
git diff --check
git status --short
git log -8 --oneline
```

Expected:

- all Compose configurations render;
- all deployment tests pass;
- the worktree is clean;
- recent history contains the external OGC design, this plan, runtime removal,
  active guide correction, and bilingual README commits.
