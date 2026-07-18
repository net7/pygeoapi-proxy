#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM

origin_repository="$temporary_directory/origin.git"
seed_repository="$temporary_directory/seed"
fake_bin="$temporary_directory/bin"
mkdir -p "$fake_bin"

git init -q --bare "$origin_repository"
git clone -q "$origin_repository" "$seed_repository"
git -C "$seed_repository" config user.name 'Deploy Test'
git -C "$seed_repository" config user.email 'deploy-test@example.test'

if [ ! -f "$repository_root/deploy.sh" ]; then
    printf 'deploy.sh does not exist\n' >&2
    exit 1
fi

bash -n "$repository_root/deploy.sh"

cp "$repository_root/deploy.sh" "$seed_repository/deploy.sh"
chmod +x "$seed_repository/deploy.sh"
git -C "$seed_repository" add deploy.sh
git -C "$seed_repository" commit -q -m 'add deploy script'
git -C "$seed_repository" branch -M staging
git -C "$seed_repository" push -q -u origin staging
previous_sha=$(git -C "$seed_repository" rev-parse HEAD)

printf 'target release\n' > "$seed_repository/release.txt"
git -C "$seed_repository" add release.txt
git -C "$seed_repository" commit -q -m 'add target release'
git -C "$seed_repository" push -q origin staging
target_sha=$(git -C "$seed_repository" rev-parse HEAD)
git -C "$origin_repository" symbolic-ref HEAD refs/heads/staging

cat > "$fake_bin/flock" <<'SCRIPT'
#!/bin/sh
exit 0
SCRIPT

cat > "$fake_bin/docker" <<'SCRIPT'
#!/bin/sh
set -eu
if [ "${1:-}" = info ]; then
    exit 0
fi
printf '%s\n' "$*" >> "$DEPLOY_COMMAND_LOG"
SCRIPT

cat > "$fake_bin/make" <<'SCRIPT'
#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$DEPLOY_COMMAND_LOG"
for argument in "$@"; do
    if [ -n "${DEPLOY_FAIL_TARGET:-}" ] && [ "$argument" = "$DEPLOY_FAIL_TARGET" ]; then
        exit 42
    fi
done
SCRIPT

cat > "$fake_bin/curl" <<'SCRIPT'
#!/bin/sh
set -eu
printf 'curl %s\n' "$*" >> "$DEPLOY_COMMAND_LOG"
SCRIPT

chmod +x "$fake_bin/flock" "$fake_bin/docker" "$fake_bin/make" "$fake_bin/curl"

create_checkout() {
    checkout_path=$1
    git clone -q "$origin_repository" "$checkout_path"
    git -C "$checkout_path" checkout -q --detach "$previous_sha"
}

invalid_output="$temporary_directory/invalid.log"
if "$repository_root/deploy.sh" production "$target_sha" > "$invalid_output" 2>&1; then
    printf 'deploy.sh unexpectedly accepted production\n' >&2
    exit 1
fi
grep -F 'Only staging deployments are supported.' "$invalid_output" > /dev/null

if "$repository_root/deploy.sh" staging "$target_sha" unexpected \
    > "$temporary_directory/extra-argument.log" 2>&1
then
    printf 'deploy.sh unexpectedly accepted an extra argument\n' >&2
    exit 1
fi
grep -F 'Usage: ./deploy.sh staging <commit-sha>' \
    "$temporary_directory/extra-argument.log" > /dev/null

missing_env_checkout="$temporary_directory/missing-env"
create_checkout "$missing_env_checkout"
if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$temporary_directory/missing-env-commands.log" \
    DEPLOY_LOCK_FILE="$temporary_directory/missing-env.lock" \
    "$missing_env_checkout/deploy.sh" staging "$target_sha" \
    > "$temporary_directory/missing-env.log" 2>&1
then
    printf 'deploy.sh unexpectedly accepted a missing .env.staging\n' >&2
    exit 1
fi
grep -F 'Missing required environment file:' "$temporary_directory/missing-env.log" > /dev/null

successful_checkout="$temporary_directory/success"
successful_commands="$temporary_directory/success-commands.log"
create_checkout "$successful_checkout"
: > "$successful_checkout/.env.staging"

PATH="$fake_bin:$PATH" \
DEPLOY_COMMAND_LOG="$successful_commands" \
DEPLOY_LOCK_FILE="$temporary_directory/success.lock" \
    "$successful_checkout/deploy.sh" staging "$target_sha" \
    > "$temporary_directory/success.log" 2>&1

[ "$(git -C "$successful_checkout" rev-parse HEAD)" = "$target_sha" ]

for expected_command in \
    '--no-print-directory ENV=staging config-check' \
    '--no-print-directory ENV=staging deploy-build' \
    '--no-print-directory ENV=staging deploy-up' \
    '--no-print-directory ENV=staging deploy-status'
do
    grep -Fx -- "$expected_command" "$successful_commands" > /dev/null
done

grep -F 'curl --fail --silent --show-error --max-time 30 http://127.0.0.1:7070/up' \
    "$successful_commands" > /dev/null
grep -F '[6/6] Verify staging' "$temporary_directory/success.log" > /dev/null
grep -F "Deployed SHA: $target_sha" "$temporary_directory/success.log" > /dev/null

failing_checkout="$temporary_directory/failure"
failing_commands="$temporary_directory/failure-commands.log"
create_checkout "$failing_checkout"
: > "$failing_checkout/.env.staging"

if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$failing_commands" \
    DEPLOY_FAIL_TARGET=deploy-build \
    DEPLOY_LOCK_FILE="$temporary_directory/failure.lock" \
    "$failing_checkout/deploy.sh" staging "$target_sha" \
    > "$temporary_directory/failure.log" 2>&1
then
    printf 'deploy.sh unexpectedly ignored a build failure\n' >&2
    exit 1
fi

grep -F 'Deploy failed during: Build images' "$temporary_directory/failure.log" > /dev/null
grep -F "Rollback command: ./deploy.sh staging $previous_sha" \
    "$temporary_directory/failure.log" > /dev/null
grep -F -- '--no-print-directory ENV=staging deploy-status' \
    "$failing_commands" > /dev/null
grep -F 'logs' "$failing_commands" > /dev/null
