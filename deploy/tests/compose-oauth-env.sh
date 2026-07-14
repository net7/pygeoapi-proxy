#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repository_root"

for variable in \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    GOOGLE_REDIRECT_URI \
    ORCID_CLIENT_ID \
    ORCID_CLIENT_SECRET \
    ORCID_REDIRECT_URI
do
    if ! grep -q "^${variable}=" .env.staging.example; then
        printf 'Missing %s in .env.staging.example\n' "$variable" >&2
        exit 1
    fi
done

rendered_config=$(mktemp)
trap 'rm -f "$rendered_config"' EXIT HUP INT TERM

GOOGLE_CLIENT_ID=test-google-client-id \
GOOGLE_CLIENT_SECRET=test-google-client-secret \
ORCID_CLIENT_ID=test-orcid-client-id \
ORCID_CLIENT_SECRET=test-orcid-client-secret \
docker compose \
    --env-file .env.staging.example \
    -f compose.yaml \
    -f compose.staging.yaml \
    config --format json > "$rendered_config"

jq -e '
    .services.laravel.environment.GOOGLE_CLIENT_ID == "test-google-client-id" and
    .services.laravel.environment.GOOGLE_CLIENT_SECRET == "test-google-client-secret" and
    .services.laravel.environment.GOOGLE_REDIRECT_URI == "https://proxygeoapi.netseven.work/auth/google/callback" and
    .services.laravel.environment.ORCID_CLIENT_ID == "test-orcid-client-id" and
    .services.laravel.environment.ORCID_CLIENT_SECRET == "test-orcid-client-secret" and
    .services.laravel.environment.ORCID_REDIRECT_URI == "https://proxygeoapi.netseven.work/auth/orcid/callback"
' "$rendered_config" > /dev/null
