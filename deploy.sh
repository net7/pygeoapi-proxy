#!/usr/bin/env bash

set -Eeuo pipefail

environment=${1:-}
requested_ref=${2:-}
repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
lock_file=${DEPLOY_LOCK_FILE:-/tmp/pygeoapi-proxy-staging.deploy.lock}
health_url=${DEPLOY_HEALTH_URL:-http://127.0.0.1:7070/up}
health_timeout=${DEPLOY_HEALTH_TIMEOUT:-30}
reexecuted=${PYGEOAPI_PROXY_DEPLOY_REEXEC:-0}
started_at=${PYGEOAPI_PROXY_DEPLOY_STARTED_AT:-$(date +%s)}
previous_sha=${PYGEOAPI_PROXY_DEPLOY_PREVIOUS_SHA:-unknown}
target_sha=${PYGEOAPI_PROXY_DEPLOY_TARGET_SHA:-unknown}
current_step=Bootstrap

if [[ -t 1 && -z ${NO_COLOR:-} ]]; then
    color_blue=$'\033[34m'
    color_green=$'\033[32m'
    color_yellow=$'\033[33m'
    color_red=$'\033[31m'
    color_reset=$'\033[0m'
else
    color_blue=
    color_green=
    color_yellow=
    color_red=
    color_reset=
fi

timestamp() {
    date -u '+%Y-%m-%dT%H:%M:%SZ'
}

info() {
    printf '%s%s INFO %s%s\n' "$color_blue" "$(timestamp)" "$*" "$color_reset"
}

success() {
    printf '%s%s OK   %s%s\n' "$color_green" "$(timestamp)" "$*" "$color_reset"
}

warning() {
    printf '%s%s WARN %s%s\n' "$color_yellow" "$(timestamp)" "$*" "$color_reset"
}

fatal() {
    printf '%s%s ERROR %s%s\n' "$color_red" "$(timestamp)" "$*" "$color_reset" >&2
    exit 1
}

section() {
    current_step=$2
    printf '\n%s[%s/6] %s%s\n' "$color_blue" "$1" "$2" "$color_reset"
}

require_command() {
    command -v "$1" > /dev/null 2>&1 || fatal "Missing required command: $1"
}

on_error() {
    exit_code=$?
    failed_command=$BASH_COMMAND
    failed_line=${BASH_LINENO[0]:-$LINENO}
    trap - ERR
    set +e

    printf '\n%s%s ERROR Deploy failed during: %s%s\n' \
        "$color_red" "$(timestamp)" "$current_step" "$color_reset" >&2
    printf 'Exit code: %s\nLine: %s\nCommand: %s\n' \
        "$exit_code" "$failed_line" "$failed_command" >&2
    printf 'Current SHA: %s\nRequested SHA: %s\nPrevious SHA: %s\n' \
        "$(git -C "$repository_root" rev-parse HEAD 2>/dev/null || printf unknown)" \
        "$target_sha" "$previous_sha" >&2

    if [[ -f "$repository_root/.env.staging" ]]; then
        make --no-print-directory ENV=staging deploy-status >&2
        make --no-print-directory ENV=staging \
            LOG_FOLLOW= LOG_TAIL=100 \
            SERVICE='laravel horizon scheduler reverb' logs >&2
    fi

    if [[ $previous_sha =~ ^[0-9a-f]{40}$ ]]; then
        printf 'Rollback command: ./deploy.sh staging %s\n' "$previous_sha" >&2
    fi

    exit "$exit_code"
}

trap on_error ERR

[[ $# -eq 2 ]] || fatal 'Usage: ./deploy.sh staging <commit-sha>'
[[ $environment == staging ]] || fatal 'Only staging deployments are supported.'

cd "$repository_root"

if [[ $reexecuted != 1 ]]; then
    section 1 'Preflight checks'

    for required_command in git docker make curl flock; do
        require_command "$required_command"
    done

    [[ -f .env.staging ]] || fatal "Missing required environment file: $repository_root/.env.staging"
    git rev-parse --is-inside-work-tree > /dev/null
    docker info > /dev/null

    exec 9> "$lock_file"
    if ! flock -n 9; then
        fatal "Another staging deployment holds lock: $lock_file"
    fi

    section 2 'Checkout requested revision'
    git fetch origin --tags --prune
    target_sha=$(git rev-parse --verify "${requested_ref}^{commit}")
    git rev-parse --verify 'origin/staging^{commit}' > /dev/null
    git merge-base --is-ancestor "$target_sha" origin/staging || \
        fatal "Requested revision is not reachable from origin/staging: $target_sha"

    previous_sha=$(git rev-parse HEAD)
    info "Previous SHA: $previous_sha"
    info "Requested SHA: $target_sha"
    git checkout -f --detach "$target_sha"

    export PYGEOAPI_PROXY_DEPLOY_REEXEC=1
    export PYGEOAPI_PROXY_DEPLOY_STARTED_AT="$started_at"
    export PYGEOAPI_PROXY_DEPLOY_PREVIOUS_SHA="$previous_sha"
    export PYGEOAPI_PROXY_DEPLOY_TARGET_SHA="$target_sha"
    exec "$repository_root/deploy.sh" staging "$target_sha"
fi

[[ $(git rev-parse HEAD) == "$target_sha" ]] || \
    fatal "Checkout SHA does not match requested SHA: $target_sha"
[[ -f .env.staging ]] || fatal "Missing required environment file: $repository_root/.env.staging"

printf '\nPygeoapi Proxy staging deployment\n'
printf 'Previous SHA: %s\nTarget SHA:   %s\n' "$previous_sha" "$target_sha"

section 3 'Validate Compose configuration'
make --no-print-directory ENV=staging config-check

section 4 'Build images'
make --no-print-directory ENV=staging deploy-build

section 5 'Update services'
make --no-print-directory ENV=staging deploy-up

section 6 'Verify staging'
make --no-print-directory ENV=staging deploy-status
curl --fail --silent --show-error --max-time "$health_timeout" "$health_url" > /dev/null

finished_at=$(date +%s)
duration=$((finished_at - started_at))
success "Deployment completed in ${duration}s"
printf 'Deployed SHA: %s\nPrevious SHA: %s\nURL: https://proxygeoapi.netseven.work\n' \
    "$target_sha" "$previous_sha"
