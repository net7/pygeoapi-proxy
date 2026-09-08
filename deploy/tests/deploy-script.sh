#!/bin/sh

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
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

printf '.env.staging\n' > "$seed_repository/.gitignore"
printf 'staging baseline without deploy script\n' > "$seed_repository/README.md"
git -C "$seed_repository" add .gitignore README.md
git -C "$seed_repository" commit -q -m 'add staging bootstrap baseline'
git -C "$seed_repository" branch -M staging
git -C "$seed_repository" push -q -u origin staging
bootstrap_sha=$(git -C "$seed_repository" rev-parse HEAD)

if [ ! -f "$repository_root/deploy-dev-staging.sh" ]; then
    printf 'deploy-dev-staging.sh does not exist\n' >&2
    exit 1
fi

bash -n "$repository_root/deploy-dev-staging.sh"

cp "$repository_root/deploy-dev-staging.sh" "$seed_repository/deploy-dev-staging.sh"
chmod +x "$seed_repository/deploy-dev-staging.sh"
git -C "$seed_repository" add deploy-dev-staging.sh
git -C "$seed_repository" commit -q -m 'add deploy script'
git -C "$seed_repository" push -q origin staging
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
if "$repository_root/deploy-dev-staging.sh" invalid "$target_sha" > "$invalid_output" 2>&1; then
    printf 'deploy-dev-staging.sh unexpectedly accepted an unsupported environment\n' >&2
    exit 1
fi
grep -F 'Only staging deployments are supported.' "$invalid_output" > /dev/null

if "$repository_root/deploy-dev-staging.sh" staging "$target_sha" unexpected \
    > "$temporary_directory/extra-argument.log" 2>&1
then
    printf 'deploy-dev-staging.sh unexpectedly accepted an extra argument\n' >&2
    exit 1
fi
grep -F 'Usage: ./deploy-dev-staging.sh staging <commit-sha>' \
    "$temporary_directory/extra-argument.log" > /dev/null

missing_env_checkout="$temporary_directory/missing-env"
create_checkout "$missing_env_checkout"
if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$temporary_directory/missing-env-commands.log" \
    DEPLOY_LOCK_FILE="$temporary_directory/missing-env.lock" \
    "$missing_env_checkout/deploy-dev-staging.sh" staging "$target_sha" \
    > "$temporary_directory/missing-env.log" 2>&1
then
    printf 'deploy-dev-staging.sh unexpectedly accepted a missing .env.staging\n' >&2
    exit 1
fi
grep -F 'Missing required environment file:' "$temporary_directory/missing-env.log" > /dev/null

unsupported_revision_checkout="$temporary_directory/unsupported-revision"
unsupported_revision_commands="$temporary_directory/unsupported-revision-commands.log"
create_checkout "$unsupported_revision_checkout"
: > "$unsupported_revision_checkout/.env.staging"

if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$unsupported_revision_commands" \
    DEPLOY_LOCK_FILE="$temporary_directory/unsupported-revision.lock" \
    "$unsupported_revision_checkout/deploy-dev-staging.sh" staging "$bootstrap_sha" \
    > "$temporary_directory/unsupported-revision.log" 2>&1
then
    printf 'Deployment unexpectedly accepted a revision without the current entrypoint\n' >&2
    exit 1
fi

if [ "$(git -C "$unsupported_revision_checkout" rev-parse HEAD)" != "$previous_sha" ]; then
    printf 'Unsupported deployment revision changed the checkout\n' >&2
    exit 1
fi
[ -x "$unsupported_revision_checkout/deploy-dev-staging.sh" ]
[ ! -s "$unsupported_revision_commands" ]
grep -F 'Requested revision does not contain deploy-dev-staging.sh:' \
    "$temporary_directory/unsupported-revision.log" > /dev/null

successful_checkout="$temporary_directory/success"
successful_commands="$temporary_directory/success-commands.log"
create_checkout "$successful_checkout"
: > "$successful_checkout/.env.staging"

PATH="$fake_bin:$PATH" \
DEPLOY_COMMAND_LOG="$successful_commands" \
DEPLOY_LOCK_FILE="$temporary_directory/success.lock" \
    "$successful_checkout/deploy-dev-staging.sh" staging "$target_sha" \
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

bootstrap_checkout="$temporary_directory/bootstrap"
bootstrap_commands="$temporary_directory/bootstrap-commands.log"
git clone -q "$origin_repository" "$bootstrap_checkout"
git -C "$bootstrap_checkout" checkout -q --detach "$bootstrap_sha"
cp "$repository_root/deploy-dev-staging.sh" "$bootstrap_checkout/deploy-dev-staging.sh"
chmod +x "$bootstrap_checkout/deploy-dev-staging.sh"
: > "$bootstrap_checkout/.env.staging"

[ "$(git -C "$bootstrap_checkout" status --porcelain --untracked-files=all)" = \
    '?? deploy-dev-staging.sh' ]

PATH="$fake_bin:$PATH" \
DEPLOY_COMMAND_LOG="$bootstrap_commands" \
DEPLOY_LOCK_FILE="$temporary_directory/bootstrap.lock" \
    "$bootstrap_checkout/deploy-dev-staging.sh" staging "$target_sha" \
    > "$temporary_directory/bootstrap.log" 2>&1

[ "$(git -C "$bootstrap_checkout" rev-parse HEAD)" = "$target_sha" ]
git -C "$bootstrap_checkout" ls-files --error-unmatch deploy-dev-staging.sh > /dev/null
[ -z "$(git -C "$bootstrap_checkout" status --porcelain --untracked-files=all)" ]
grep -F "Previous SHA: $bootstrap_sha" \
    "$temporary_directory/bootstrap.log" > /dev/null
grep -F "Deployed SHA: $target_sha" \
    "$temporary_directory/bootstrap.log" > /dev/null

git -C "$bootstrap_checkout" checkout -q --detach "$bootstrap_sha"
cp "$repository_root/deploy-dev-staging.sh" "$bootstrap_checkout/deploy-dev-staging.sh"
chmod +x "$bootstrap_checkout/deploy-dev-staging.sh"

if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$bootstrap_commands" \
    DEPLOY_FAIL_TARGET=deploy-build \
    DEPLOY_LOCK_FILE="$temporary_directory/bootstrap-failure.lock" \
    "$bootstrap_checkout/deploy-dev-staging.sh" staging "$target_sha" \
    > "$temporary_directory/bootstrap-failure.log" 2>&1
then
    printf 'Bootstrap deployment unexpectedly ignored a build failure\n' >&2
    exit 1
fi

grep -F 'Deploy failed during: Build images' "$temporary_directory/bootstrap-failure.log" > /dev/null
if grep -F 'Rollback command:' "$temporary_directory/bootstrap-failure.log" > /dev/null; then
    printf 'Bootstrap failure advertised an unsupported rollback revision\n' >&2
    exit 1
fi

failing_checkout="$temporary_directory/failure"
failing_commands="$temporary_directory/failure-commands.log"
create_checkout "$failing_checkout"
: > "$failing_checkout/.env.staging"

if PATH="$fake_bin:$PATH" \
    DEPLOY_COMMAND_LOG="$failing_commands" \
    DEPLOY_FAIL_TARGET=deploy-build \
    DEPLOY_LOCK_FILE="$temporary_directory/failure.lock" \
    "$failing_checkout/deploy-dev-staging.sh" staging "$target_sha" \
    > "$temporary_directory/failure.log" 2>&1
then
    printf 'deploy-dev-staging.sh unexpectedly ignored a build failure\n' >&2
    exit 1
fi

grep -F 'Deploy failed during: Build images' "$temporary_directory/failure.log" > /dev/null
grep -F "Rollback command: ./deploy-dev-staging.sh staging $previous_sha" \
    "$temporary_directory/failure.log" > /dev/null
grep -F -- '--no-print-directory ENV=staging deploy-status' \
    "$failing_commands" > /dev/null
grep -F 'logs' "$failing_commands" > /dev/null
