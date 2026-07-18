#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM

fake_bin="$temporary_directory/bin"
docker_log="$temporary_directory/docker.log"
environment_file="$temporary_directory/staging.env"
mkdir -p "$fake_bin"

cat > "$fake_bin/docker" <<'SCRIPT'
#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$DOCKER_LOG"
SCRIPT
chmod +x "$fake_bin/docker"

cd "$repository_root"

if PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" require-env \
    > "$temporary_directory/missing-env.log" 2>&1
then
    printf 'require-env unexpectedly accepted a missing file\n' >&2
    exit 1
fi

grep -F "Missing required environment file: $environment_file" \
    "$temporary_directory/missing-env.log" > /dev/null

: > "$environment_file"

PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" config-check
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" deploy-build
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" \
    DEPLOY_STOP_TIMEOUT=45 DEPLOY_WAIT_TIMEOUT=90 deploy-up
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" deploy-status
PATH="$fake_bin:$PATH" DOCKER_LOG="$docker_log" \
    make ENV=staging ENV_FILE="$environment_file" \
    LOG_FOLLOW= LOG_TAIL=25 SERVICE='laravel horizon' logs

compose_prefix="compose --env-file $environment_file -f compose.yaml -f compose.staging.yaml"

for expected_command in \
    "$compose_prefix config --quiet" \
    "$compose_prefix build --pull" \
    "$compose_prefix stop -t 45 horizon scheduler reverb" \
    "$compose_prefix up -d --no-build --wait --wait-timeout 90 laravel" \
    "$compose_prefix up -d --no-build --remove-orphans --wait --wait-timeout 90" \
    "$compose_prefix ps" \
    "$compose_prefix logs --tail=25 laravel horizon"
do
    if ! grep -Fx "$expected_command" "$docker_log" > /dev/null; then
        printf 'Missing Docker invocation: %s\n' "$expected_command" >&2
        exit 1
    fi
done
