# Bilingual Project Documentation Design

**Date:** 2026-07-26

## Goal

Replace the deployment-heavy root README with a concise, welcoming project
overview while preserving its opening ASCII art. Move deployment and operations
content into detailed, canonical deployment guides. Publish both English and
Italian versions without mixing languages inside the same document.

## Document Set

### `README.md`

The canonical English project overview will:

- preserve the existing ASCII art exactly at the beginning;
- provide an immediately visible link to `README.it.md`;
- explain what pygeoapi-proxy does and who it serves;
- summarize its main capabilities;
- describe the OGC process execution flow at a high level;
- identify the main application components and technologies;
- provide a minimal development quick start;
- link prominently to `DEPLOY.md` for complete deployment instructions.

It will intentionally omit detailed environment, CI/CD, rollback, and
troubleshooting procedures.

### `README.it.md`

The Italian overview will mirror the English README structure and meaning. It
will link back to `README.md`, preserve the same opening ASCII art, and direct
Italian readers to `DEPLOY.it.md`.

### `DEPLOY.md`

The canonical English deployment guide will consolidate and update the current
root deployment documentation and the detailed staging material currently kept
in `deploy/README.md`. It will cover:

- supported environments and their differences;
- Docker Compose topology and service responsibilities;
- prerequisites and environment-file preparation;
- required production and staging secrets;
- local development, staging, and production commands;
- application build and runtime behavior;
- staging CI/CD architecture and GitLab configuration;
- server bootstrap, Nginx, TLS, and health checks;
- automatic and manual deployment;
- rollback constraints;
- routine operations, backups, diagnostics, and troubleshooting;
- deployment security considerations;
- a concise file map for deployment-related assets.

Host-specific staging details that are part of the repository's current
operational contract will be retained. Nginx commands that already have a
specialized runbook will be summarized and linked rather than duplicated in
full.

### `DEPLOY.it.md`

The Italian deployment guide will mirror the structure, commands, warnings, and
operational meaning of `DEPLOY.md`. It will link back to the English version and
to the Italian README.

### `deploy/README.md`

The existing guide will become a short bilingual navigation page pointing to:

- `../DEPLOY.md`;
- `../DEPLOY.it.md`;
- `nginx/README.md`.

This preserves existing repository links while removing a competing source of
deployment truth.

### `deploy/nginx/README.md`

The specialized Nginx and certificate runbook remains in place. It will only be
changed if a relative documentation link must be corrected.

## Application Description

The README overview will describe the application as a Laravel and React
interface in front of pygeoapi. Authenticated users can browse cached OGC
process definitions, complete dynamically generated and validated forms,
request selected outputs, and submit asynchronous executions. Laravel records
the execution, queue workers submit and poll the remote pygeoapi job, and the UI
shows live status and persisted results. Supported previews include structured
data, CSV tables, charts, and GeoTIFF/SLD map layers published through
GeoServer. Administrative features, localization, authentication, and job
history will be mentioned without turning the README into a feature manual.

## Deployment Source of Truth

Deployment facts must be verified against the implementation before being
documented:

- `Makefile`;
- `compose.yaml` and environment-specific Compose overrides;
- `.env.*.example`;
- `.gitlab-ci.yml`;
- `deploy.sh`;
- `proxy/Dockerfile` and the root `Dockerfile`;
- existing deployment and Nginx runbooks.

The new guides must not invent commands, defaults, ports, secrets, or
production automation that the repository does not provide. Production must be
clearly distinguished from the currently automated staging deployment.

## Editorial Style

All four primary documents will use:

- short introductory paragraphs;
- a shallow and predictable heading hierarchy;
- compact tables where they improve environment or service comparisons;
- copyable command blocks;
- explicit warnings for destructive operations and rollback limitations;
- consistent terminology between languages;
- relative links that work from the repository root.

The tone will be practical and polished. Decorative badges and screenshots are
out of scope because they would introduce unverified or maintenance-heavy
content.

## Validation

Before completion:

1. confirm the README ASCII art is byte-for-byte unchanged;
2. scan all new Markdown files for placeholders and stale references;
3. verify every repository-relative link resolves;
4. compare commands, ports, environment names, and service names with the
   current configuration;
5. compare English and Italian heading structures and operational warnings;
6. inspect the final diff to ensure no application code or unrelated
   documentation changed.

No application test suite is required for a documentation-only change, but
repository deployment-documentation tests should be run when they validate
paths or commands affected by this reorganization.

## Out of Scope

- application behavior or configuration changes;
- a production CI/CD pipeline;
- changes to infrastructure credentials or server state;
- generated documentation sites;
- screenshots or architecture artwork;
- translation of unrelated project documents.
