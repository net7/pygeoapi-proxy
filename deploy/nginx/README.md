# Staging Nginx reverse proxy

This directory contains the initial HTTP-only host configuration for
`proxygeoapi.netseven.work`. Docker publishes Laravel on `127.0.0.1:7070` and
Reverb on `127.0.0.1:7071`; neither port should be reachable from outside the
staging host.

The repository is installed at:

```text
/docker-data/configuration/pygeoapi-proxy
```

## 1. Start the staging stack

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

## 4. Verify routing

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
