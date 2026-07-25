#!/bin/sh

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
rendered_config=$(mktemp)
trap 'rm -f "$rendered_config"' EXIT HUP INT TERM

cd "$repository_root"

expected_endpoint=https://voice.pi.ingv.it/geoinquire/

for environment in develop staging production; do
    environment_file=".env.${environment}.example"

    if ! grep -Fx "OGC_PROCESSES_BASE_URL=$expected_endpoint" \
        "$environment_file" > /dev/null; then
        printf 'Missing remote OGC endpoint in %s\n' "$environment_file" >&2
        exit 1
    fi

    if grep -E '^(PYGEOAPI_BASE_URL|PYGEOAPI_SERVER_URL|PYGEOAPI_PORT)=' \
        "$environment_file" > /dev/null; then
        printf 'Legacy pygeoapi setting remains in %s\n' \
            "$environment_file" >&2
        exit 1
    fi

    docker compose \
        --env-file "$environment_file" \
        -f compose.yaml \
        -f "compose.${environment}.yaml" \
        config --format json > "$rendered_config"

    jq -e --arg endpoint "$expected_endpoint" '
        . as $config |
        ($config.services | has("pygeoapi") | not) and
        (["laravel", "horizon", "scheduler", "reverb"] |
            all(. as $service |
                $config.services[$service].environment.OGC_PROCESSES_BASE_URL
                    == $endpoint and
                ($config.services[$service].depends_on |
                    has("pygeoapi") | not)
            )
        )
    ' "$rendered_config" > /dev/null
done

for obsolete_file in Dockerfile entrypoint.sh my.config.yml; do
    if [ -e "$obsolete_file" ]; then
        printf 'Obsolete local pygeoapi file remains: %s\n' \
            "$obsolete_file" >&2
        exit 1
    fi
done
