#!/bin/sh
# Contract strings intentionally preserve shell expressions literally.
# shellcheck disable=SC2016

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
runbook="$repository_root/deploy/README.md"

if [ ! -f "$runbook" ]; then
    printf 'deploy/README.md does not exist\n' >&2
    exit 1
fi

require_text() {
    text=$1
    if ! grep -F "$text" "$runbook" > /dev/null; then
        printf 'Missing bootstrap runbook contract: %s\n' "$text" >&2
        exit 1
    fi
}

require_text '## Bootstrap del primo deploy automatico'
require_text 'SOURCE_SHA=$(git -C "$DEPLOY_PATH" rev-parse'
require_text 'git -C "$DEPLOY_PATH" show "${SOURCE_SHA}:deploy.sh"'
require_text 'ACTUAL_BLOB=$(git -C "$DEPLOY_PATH" hash-object "$TEMPORARY_SCRIPT")'
require_text 'bash -n "$TEMPORARY_SCRIPT"'
require_text '?? deploy.sh'
require_text 'git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy.sh'
require_text '## Verifica del primo deploy automatico'
require_text 'https://proxygeoapi.netseven.work/up'
