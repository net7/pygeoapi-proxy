#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
rendered_config=$(mktemp)
trap 'rm -f "$rendered_config"' EXIT HUP INT TERM

cd "$repository_root"

docker compose \
    --env-file .env.staging.example \
    -f compose.yaml \
    -f compose.staging.yaml \
    config --format json > "$rendered_config"

jq -e '
    . as $config |
    $config.services.laravel.environment.AUTORUN_ENABLED == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_MIGRATION == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_MIGRATION_FORCE == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_MIGRATION_ISOLATION == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_OPTIMIZE == "true" and
    $config.services.laravel.environment.AUTORUN_LARAVEL_STORAGE_LINK == "true" and
    (["horizon", "scheduler", "reverb"] | all(. as $service |
        $config.services[$service].environment.AUTORUN_ENABLED == "true" and
        $config.services[$service].environment.AUTORUN_LARAVEL_MIGRATION == "false" and
        $config.services[$service].environment.AUTORUN_LARAVEL_OPTIMIZE == "true" and
        $config.services[$service].environment.AUTORUN_LARAVEL_STORAGE_LINK == "false"
    ))
' "$rendered_config" > /dev/null
