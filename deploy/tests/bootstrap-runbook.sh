#!/bin/sh
# Contract strings intentionally preserve shell expressions literally.
# shellcheck disable=SC2016

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
english_runbook="$repository_root/DEPLOY.md"
italian_runbook="$repository_root/DEPLOY.it.md"
deployment_index="$repository_root/deploy/README.md"
api_reference="$repository_root/PYGEOAPI.md"

require_file() {
    file=$1
    if [ ! -f "$file" ]; then
        printf 'Required deployment document does not exist: %s\n' "$file" >&2
        exit 1
    fi
}

require_text() {
    file=$1
    text=$2
    if ! grep -F -- "$text" "$file" > /dev/null; then
        printf 'Missing deployment documentation contract in %s: %s\n' \
            "$file" "$text" >&2
        exit 1
    fi
}

require_absent_text() {
    file=$1
    text=$2
    if grep -F -- "$text" "$file" > /dev/null; then
        printf 'Obsolete deployment documentation in %s: %s\n' \
            "$file" "$text" >&2
        exit 1
    fi
}

require_file "$english_runbook"
require_file "$italian_runbook"
require_file "$deployment_index"
require_file "$api_reference"

require_text "$english_runbook" '## First automatic deployment bootstrap'
require_text "$english_runbook" '## Verify the first automatic deployment'
require_text "$italian_runbook" '## Bootstrap del primo deploy automatico'
require_text "$italian_runbook" '## Verifica del primo deploy automatico'

for runbook in "$english_runbook" "$italian_runbook"; do
    require_text "$runbook" 'SOURCE_SHA=$(git -C "$DEPLOY_PATH" rev-parse'
    require_text "$runbook" 'git -C "$DEPLOY_PATH" show "${SOURCE_SHA}:deploy.sh"'
    require_text "$runbook" 'ACTUAL_BLOB=$(git -C "$DEPLOY_PATH" hash-object "$TEMPORARY_SCRIPT")'
    require_text "$runbook" 'bash -n "$TEMPORARY_SCRIPT"'
    require_text "$runbook" '?? deploy.sh'
    require_text "$runbook" 'git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy.sh'
    require_text "$runbook" 'https://proxygeoapi.netseven.work/up'
    require_text "$runbook" "read -r -s -p 'Staging Basic Auth (user:password): ' STAGING_BASIC_AUTH"
    require_text "$runbook" '--user "$STAGING_BASIC_AUTH"'
    require_text "$runbook" 'unset STAGING_BASIC_AUTH'
done

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

require_text "$deployment_index" '../DEPLOY.md'
require_text "$deployment_index" '../DEPLOY.it.md'
require_text "$deployment_index" 'nginx/README.md'
