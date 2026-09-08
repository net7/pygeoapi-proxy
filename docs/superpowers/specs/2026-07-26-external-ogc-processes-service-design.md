# External OGC Processes Service Design

**Date:** 2026-07-26

## Goal

Remove the local `pygeoapi` container from proxygeoapi and make the repository
describe and configure the application for its actual role: proxying an existing
remote OGC Processes API.

The default remote endpoint is:

```text
https://voice.pi.ingv.it/geoinquire/
```

Deployments may override it through `OGC_PROCESSES_BASE_URL`.

## Architecture

The Docker Compose stack continues to provide the application services owned by
this repository:

- Laravel web application
- Horizon queue worker
- Laravel scheduler
- Reverb server
- MariaDB
- Redis
- GeoServer
- Vite, phpMyAdmin, and Mailpit in development

`pygeoapi` is not an application-owned service and must not be built, started,
health-checked, or exposed by this repository.

The processing flow is:

```text
Browser
  -> Laravel proxy
  -> Horizon queue worker
  -> remote OGC Processes API (pygeoapi)
  -> remote result resources
```

The browser polls the Laravel HTTP API for process status. Reverb remains part
of the application stack, but it is not the transport used for these status
updates. GeoServer remains a local Compose service because it is independently
used by the application.

## Configuration

`compose.yaml` will pass this setting to every Laravel role derived from the
shared application service:

```yaml
OGC_PROCESSES_BASE_URL: ${OGC_PROCESSES_BASE_URL:-https://voice.pi.ingv.it/geoinquire/}
```

The supported environment examples for development and staging expose the same
setting and default value. The obsolete variables
`PYGEOAPI_BASE_URL`, `PYGEOAPI_SERVER_URL`, and `PYGEOAPI_PORT` will be
removed.

The existing Laravel client remains responsible for remote calls. Its timeout,
connection timeout, retry, failure, and result-host validation behavior is not
changed by this work.

## Repository Changes

The following local pygeoapi runtime files will be deleted:

- `/Dockerfile`
- `/entrypoint.sh`
- `/my.config.yml`

The `pygeoapi` service, its port, health check, volume, environment, and
`depends_on` relationships will be removed from `compose.yaml` and
`compose.develop.yaml`.

The Makefile will:

- stop building a `pygeoapi` image during deployment;
- remove the `pygeoapi-validate` target and its help entry;
- keep all Laravel and infrastructure targets unchanged.

The application and database identifiers containing `pygeoapi_proxy` remain
unchanged. They identify this product and are not evidence of a local pygeoapi
runtime.

## Documentation

The active documentation will consistently distinguish the remote pygeoapi
service from the local Docker stack:

- `README.md` and `README.it.md` will describe proxygeoapi as a proxy and list
  the precise application stack;
- `DEPLOY.md` and `DEPLOY.it.md` will document
  `OGC_PROCESSES_BASE_URL`, remote connectivity checks, and deployment without
  a pygeoapi container;
- `PYGEOAPI.md` will remain as the external API reference, but local
  `localhost:5000` and bundled-container assumptions will be replaced with the
  configurable remote endpoint;
- `deploy/README.md` and the nginx runbook will remain concise indexes where no
  pygeoapi runtime instructions exist.

Historical planning documents under `docs/superpowers/` and
`proxy/docs/superpowers/` will not be rewritten. They are retained as a record
of earlier decisions.

## Testing

Regression tests will verify that:

- rendered Compose configuration contains no `pygeoapi` service;
- Laravel, Horizon, scheduler, and Reverb receive
  `OGC_PROCESSES_BASE_URL`;
- no Laravel service depends on a local pygeoapi container;
- `make deploy-build` builds only the Laravel image;
- active guides no longer instruct operators to build, start, expose, or
  health-check a local pygeoapi service;
- the external endpoint and its override variable are documented in both
  languages.

The full deployment shell test suite, Compose configuration rendering, and
ShellCheck will be run before completion.

## Out of Scope

This change does not:

- deploy, administer, or version the remote pygeoapi installation;
- change the OGC Processes HTTP contract;
- alter process execution, polling, queue, or result-storage behavior;
- rename existing application namespaces, database names, or product-specific
  identifiers;
- rewrite historical design and implementation documents.

## Success Criteria

The repository can build and start its supported local stack without any
pygeoapi image or container. All application roles resolve their OGC Processes
backend through `OGC_PROCESSES_BASE_URL`, whose documented default is
`https://voice.pi.ingv.it/geoinquire/`. The English and Italian documentation
accurately represents this architecture.
