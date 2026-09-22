![proxygeoapi](docs/assets/proxygeoapi-wordmark.svg)

[Italiano](README.it.md)

# proxygeoapi

An ordered, bilingual interface for discovering and running remote OGC
processes—without exposing the processing backend directly to users.

## What it does

proxygeoapi is a Laravel and React/Inertia application that sits in front of a
remote pygeoapi OGC API - Processes service. Authenticated users can browse
cached process definitions, fill in forms generated from their schemas, submit
executions, follow their status, and inspect the resulting data.

The upstream service is configured with `OGC_PROCESSES_BASE_URL`. Its default
is `https://voice.pi.ingv.it/geoinquire/` in development and staging. The
upstream deployment and version are managed outside this repository.

## Highlights

- Dynamic forms generated from OGC process input schemas.
- Browser-side validation backed by AJV and authoritative Laravel validation.
- Persistent, asynchronous executions handled by Redis and Horizon.
- HTTP status polling, durable job history, and administrative user/job tools.
- JSON and CSV inspection, chart previews, and GeoTIFF/SLD map layers published
  through GeoServer.
- Google and ORCID OAuth, email OTP, and passkey support when configured.
- English and Italian application interface and documentation.

## How it works

1. Laravel synchronizes and caches the process catalogue exposed by the remote
   OGC endpoint.
2. React/Inertia renders the selected process as a typed, schema-driven form.
3. The browser and Laravel validate the inputs; Laravel persists the execution
   and dispatches it to Redis.
4. Horizon submits the request to external pygeoapi and polls the upstream job
   until it reaches a terminal state.
5. The browser polls Laravel over HTTP. Results remain in job history and can
   be rendered as structured data, tables, charts, or geospatial previews.

Reverb is part of the application's realtime infrastructure, but OGC execution
status updates use HTTP polling.

## Architecture

```text
Browser -> Laravel/Inertia -> Redis/Horizon -> external pygeoapi
   ^             |                                  |
   |          Database <--- execution status/results+
   |
   +---------- HTTP status polling and previews via Laravel/GeoServer
```

Development and staging own Laravel, Horizon, Scheduler, Reverb, MariaDB,
Redis, and GeoServer. Development also adds Vite, phpMyAdmin, and Mailpit.

## Technology stack

Versions below come from `proxy/composer.lock`, `proxy/bun.lock`, and the
container configuration. Floating image tags are identified explicitly.

| Area | Technologies and current versions |
| --- | --- |
| Runtime | PHP `8.5`; bundled Nginx |
| Backend | Laravel `13.32.0`; Inertia Laravel `3.3.4` |
| Authentication | Fortify `1.39.0`; Socialite `5.31.0`; Google provider `4.1.0`; custom ORCID OAuth and email OTP; Laravel Passkeys JS `0.2.0` |
| Async and realtime | Horizon `5.49.0`; Reverb `1.11.1`; Echo and Echo React `2.5.0`; Pusher JS `8.6.0`; Redis `alpine` (floating tag) |
| Frontend | React and React DOM `19.3.0`; Inertia React `3.7.1`; TypeScript `5.9.3` |
| UI | Local shadcn/ui components (New York) built on Radix UI; Tailwind CSS `4.3.3`; Lucide React `0.475.0`; Sonner `2.0.8` |
| Typography | Source Sans 3 Variable and Roboto Mono Variable, both `5.3.0` via Fontsource |
| Validation and data | AJV `8.17.1`; TanStack React Table `8.21.3`; JSON View `2.0.0-alpha.43`; Tiptap `3.31.3` |
| Maps and charts | MapLibre GL `5.24.0`; Chart.js `4.5.1`; GeoServer `3.0.1` |
| OGC processing | Remote pygeoapi / OGC API - Processes; endpoint configured with `OGC_PROCESSES_BASE_URL`; upstream version managed externally |
| Persistence | MariaDB `latest`; Redis `alpine` (floating tags) |
| Build | Vite `8.3.0`; Inertia Vite `3.7.1`; React Compiler `1.0.0`; Bun `1.4.2` in development/staging images and CI; Node `latest` in development/staging images |
| Containers and CI | Docker Compose; GitLab CI; Docker CLI `29`; Composer `2`; Alpine `3.24` deploy image |
| Development only | Vite dev server; phpMyAdmin `latest`; Mailpit `latest` |

## Interface and design

The interface uses the INGV logo palette, light and dark themes, square corners,
global styled scrollbars, and subtle glass effects on cards. Shared hover and
keyboard focus treatments keep controls consistent across the application.

**[DESIGN.md](DESIGN.md)** documents the design guidelines in Italian: color
tokens, typography, layout, component composition, motion, accessibility, and
the complete frontend dependency inventory with versions and source references.

Bun is the frontend package manager used by CI and container builds. Run
`bun ci` from `proxy/` for a reproducible installation; use `bun.lock` as the
reference for frontend versions. Frontend checks and scripts are listed in
[the design guide](DESIGN.md#13-comandi-e-verifica).

## Quick start

Requirements: Git, Docker with Docker Compose, and GNU Make.

```bash
make env
make up
```

Default development endpoints:

| Service | URL |
| --- | --- |
| Application | `http://localhost:8088` |
| Reverb | `http://localhost:8089` |
| Vite | `http://localhost:5174` |
| GeoServer | `http://localhost:8091/geoserver` |
| phpMyAdmin | `http://localhost:8090` |
| Mailpit | `http://localhost:8026` |

## Deployment

All deployment files, examples, and guides in this repository refer
exclusively to `develop` and `staging`. Make supports both environments;
`deploy-dev-staging.sh` automates staging only. See **[DEPLOY.md](DEPLOY.md)**
for operations, server bootstrap, verification, backups, and troubleshooting.

## Documentation map

- [Italian project overview](README.it.md)
- [Design guidelines and complete frontend stack (Italian)](DESIGN.md)
- [English deployment guide](DEPLOY.md)
- [Guida al deploy in italiano](DEPLOY.it.md)
- [External pygeoapi API reference](PYGEOAPI.md)
- [Staging Nginx and TLS runbook](deploy/nginx/README.md)
