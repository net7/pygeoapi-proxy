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
is `https://voice.pi.ingv.it/geoinquire/` in development and staging. Production
uses `http://pygeoapi_service/` on the existing Docker network; the upstream
deployment and version are managed outside this repository.

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
Production uses the independent `compose.voice-ui.yaml`. Web, Horizon, and
Reverb join an external network to reuse the existing PostgreSQL, pygeoapi, and
Nginx services. It publishes no host ports; Redis and GeoServer remain on the
UI's private network.

## Technology stack

Versions below come from the committed lockfiles and container configuration.
Floating image tags are identified explicitly.

| Area | Technologies and current versions |
| --- | --- |
| Runtime | PHP `8.5` in development/staging; production defaults to `serversideup/php:8.4-fpm-nginx`; bundled Nginx |
| Backend | Laravel `13.22.0`; Inertia Laravel `3.1.1` |
| Authentication | Fortify `1.37.3`; Socialite `5.29.0`; Google provider `4.1.0`; custom ORCID OAuth and email OTP; Laravel Passkeys JS `0.2.0` |
| Async and realtime | Horizon `5.48.1`; Reverb `1.11.0`; Redis `alpine` (floating tag) |
| Frontend | React and React DOM `19.2.8`; Inertia React `3.6.1`; TypeScript `5.9.3` |
| UI | Tailwind CSS `4.3.3`; Headless UI `2.2.10`; Radix UI primitives locked individually in `bun.lock`; Lucide React `0.475.0`; Roboto Mono `5.3.0` |
| Validation and data | AJV `8.17.1`; TanStack React Table `8.21.3`; JSON View `2.0.0-alpha.43`; Tiptap `3.29.0` |
| Maps and charts | MapLibre GL `5.24.0`; Chart.js `4.5.1`; GeoServer `2.27.1` |
| OGC processing | Remote pygeoapi / OGC API - Processes; endpoint configured with `OGC_PROCESSES_BASE_URL`; upstream version managed externally |
| Persistence | Development/staging: MariaDB `latest`, Redis `alpine` (floating tags); production: existing PostgreSQL and private Redis `7-alpine` |
| Build | Vite `8.1.5`; Bun `latest` and Node `latest` in development/staging images; production: Bun `1.3.14` and Node `24-bookworm-slim`; CI: Bun `1.3.14` |
| Containers and CI | Docker Compose; GitLab CI; Docker CLI `29`; Composer `2`; Alpine `3.24` deploy image |
| Development only | Vite dev server; phpMyAdmin `latest`; Mailpit `latest` |

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

Production uses `compose.voice-ui.yaml` and a root `.env` copied from
`.env.voice-ui.example`. Set `VOICE_UI_HOST` there; its initial value is
`voice_ui.pi.ingv.it`.

See **[DEPLOY.md](DEPLOY.md)** for production deployment and customer smoke
tests, development/staging operations, server bootstrap, and troubleshooting.

## Documentation map

- [Italian project overview](README.it.md)
- [English deployment guide](DEPLOY.md)
- [Guida al deploy in italiano](DEPLOY.it.md)
- [External pygeoapi API reference](PYGEOAPI.md)
- [Staging Nginx and TLS runbook](deploy/nginx/README.md)
