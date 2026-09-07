# Nginx reverse proxies

This runbook covers the standalone staging host and the Voice UI virtual host
loaded by the customer's existing production Nginx container. The two
procedures use different Compose projects and must be operated separately.

## Staging

This directory contains the initial HTTP-only host configuration for
`proxygeoapi.netseven.work`. Docker publishes Laravel on `127.0.0.1:7070` and
Reverb on `127.0.0.1:7071`; neither port should be reachable from outside the
staging host.

The repository is installed at:

```text
/docker-data/configuration/pygeoapi-proxy
```

### 1. Start the staging stack

```bash
cd /docker-data/configuration/pygeoapi-proxy
make staging config >/dev/null
make staging up
curl --fail --silent --show-error http://127.0.0.1:7070/up >/dev/null
```

The Reverb process must also be healthy:

```bash
docker compose --env-file .env.staging -f compose.yaml -f compose.staging.yaml ps reverb
```

### 2. Install the HTTP bootstrap vhost

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

### 3. Issue and install the first certificate

Back up the installed Nginx configuration, then let Certbot obtain the
certificate, add the TLS listener, and enable the HTTP-to-HTTPS redirect:

```bash
sudo cp \
  /etc/nginx/conf.d/proxygeoapi.netseven.work.conf \
  /etc/nginx/conf.d/proxygeoapi.netseven.work.conf.before-certbot
sudo certbot --nginx -d proxygeoapi.netseven.work --redirect
sudo nginx -t
sudo systemctl reload nginx
PUBLIC_STATUS=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' https://proxygeoapi.netseven.work)
case "$PUBLIC_STATUS" in
  200|401) printf 'HTTPS reachable: %s\n' "$PUBLIC_STATUS" ;;
  *) printf 'Unexpected HTTPS status: %s\n' "$PUBLIC_STATUS" >&2; exit 1 ;;
esac
```

Certbot modifies the installed copy under `/etc/nginx/conf.d`; the repository
file remains an HTTP-only bootstrap template. Do not overwrite the installed
file with the repository template after Certbot without first preserving the
generated TLS directives.

### 4. Verify routing

```bash
bash <<'BASH'
set -Eeuo pipefail
read -r -s -p 'Staging Basic Auth (user:password): ' STAGING_BASIC_AUTH
printf '\n'
curl --fail --silent --show-error --user "$STAGING_BASIC_AUTH" \
  https://proxygeoapi.netseven.work/up > /dev/null
REVERB_STATUS=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --user "$STAGING_BASIC_AUTH" \
  https://proxygeoapi.netseven.work/app/invalid)
unset STAGING_BASIC_AUTH
printf 'Application health: OK\nReverb probe: %s\n' "$REVERB_STATUS"
case "$REVERB_STATUS" in
  000|502) exit 1 ;;
esac
BASH
```

The application health check must exit `0`. The Reverb probe may return an
application error for the invalid key, but it must not return `000` or `502`;
either value indicates that Nginx cannot reach Reverb on `127.0.0.1:7071`.
Enter `user:password` only at the hidden prompt; never place staging Basic Auth
credentials in this repository or in shell history.

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

## Production Voice UI

Production publishes no host ports. The existing `nginx_container`, running
the existing `nginx:1.23.4` image, reaches `voice-ui-web:8080` and
`voice-ui-reverb:8000` through the external network selected by
`PRODUCTION_NETWORK`. GeoServer is intentionally absent from the public virtual
host.

Complete the root `.env` from `.env.voice-ui.example` first. The configured TLS
certificate and key paths are absolute paths inside `nginx_container`, and the
certificate must cover `VOICE_UI_HOST`.

Render to a persistent absolute host path whose parent directory already
exists, or create that directory explicitly:

```bash
cd /absolute/path/to/pygeoapi-proxy
VOICE_UI_NGINX_CONF=/absolute/persistent/path/voice-ui.conf
sudo install -d -m 0755 "$(dirname "$VOICE_UI_NGINX_CONF")"
sudo deploy/nginx/render-voice-ui.sh .env "$VOICE_UI_NGINX_CONF"
```

The renderer validates the resolved hostname and certificate paths through the
production Compose configuration. It renders only; it never starts, replaces,
or reloads Nginx.

For the first installation, add the persistent bind to `nginx_service` in the
customer's complete authoritative Compose definition:

```text
/absolute/persistent/path/voice-ui.conf:/etc/nginx/conf.d/voice-ui.conf:ro
```

Keep `nginx_service` attached to the external production network. Recreate only
that service using the customer's complete established Compose command so
Docker creates the new bind mount. Do not create a duplicate Nginx service from
this repository.

After the recreation, and after every later render, validate before reload:

```bash
docker exec nginx_container nginx -t
docker exec nginx_container nginx -s reload
```

On later updates, render to the same host path. The renderer overwrites an
existing regular file without replacing its inode, so the running container's
bind mount sees the new contents. It rejects symbolic-link output and unsafe
hostname or certificate-path values.

Resolve the configured public host from Compose before probing it:

```bash
voice_ui_host=$(docker compose --env-file .env -f compose.voice-ui.yaml \
  config --format json | jq -r '.services.web.environment.VOICE_UI_HOST')
curl --fail --silent --show-error "https://${voice_ui_host}/up" >/dev/null
curl --fail --silent --show-error "https://${voice_ui_host}/login" >/dev/null
```

Confirm a `101 Switching Protocols` WebSocket handshake at
`wss://VOICE_UI_HOST/app/...` in the browser network tools. Process status and
results use HTTP polling, so validate that workflow independently.

For a hostname change, update DNS, install a certificate covering the new name,
change `VOICE_UI_HOST` and certificate paths in `.env`, recreate `web`,
`horizon`, and `reverb` with the standalone production Compose command, then
render to the same host path and run `nginx -t` followed by reload. The public
Reverb configuration is supplied at runtime; no frontend asset rebuild is
required.
