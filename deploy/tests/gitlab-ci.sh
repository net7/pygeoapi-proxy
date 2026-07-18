#!/bin/sh

set -eu

repository_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
ci_file="$repository_root/.gitlab-ci.yml"

if [ ! -f "$ci_file" ]; then
    printf '.gitlab-ci.yml does not exist\n' >&2
    exit 1
fi

require_text() {
    text=$1
    if ! grep -F "$text" "$ci_file" > /dev/null; then
        printf 'Missing GitLab CI contract: %s\n' "$text" >&2
        exit 1
    fi
}

require_text 'workflow:'
require_text "\$CI_PIPELINE_SOURCE == \"merge_request_event\""
require_text "\$CI_MERGE_REQUEST_TARGET_BRANCH_NAME =~ /^(develop|staging)$/"
require_text "\$CI_PIPELINE_SOURCE == \"push\" && \$CI_COMMIT_BRANCH == \"staging\""
require_text 'php-check:'
require_text 'frontend-check:'
require_text 'deployment-check:'
require_text 'deploy:staging:'
require_text 'GIT_STRATEGY: none'
require_text 'resource_group: staging'
require_text 'name: staging'
require_text 'url: https://proxygeoapi.netseven.work'
require_text "./deploy.sh staging '\$CI_COMMIT_SHA'"
require_text '*[!A-Za-z0-9_./-]*'
require_text '*[!0-9a-f]*'
require_text "\${#CI_COMMIT_SHA}"
require_text 'DEPLOY_KNOWN_HOSTS'
require_text 'DEPLOY_SSH_KEY'
require_text 'DEPLOY_PORT'
require_text 'DEPLOY_PORT must contain only decimal digits'
require_text 'DEPLOY_PORT must be between 1 and 65535'
require_text "ssh -p \"\$DEPLOY_PORT\""

php_job=$(sed -n '/^php-check:/,/^frontend-check:/p' "$ci_file")
frontend_job=$(sed -n '/^frontend-check:/,/^deploy:staging:/p' "$ci_file")

require_php_text() {
    text=$1
    if ! printf '%s\n' "$php_job" | grep -F "$text" > /dev/null; then
        printf 'Missing php-check contract: %s\n' "$text" >&2
        exit 1
    fi
}

require_php_text 'install-php-extensions gd pcntl'
require_php_text 'image: composer:2'
require_php_text 'COMPOSER_ALLOW_SUPERUSER: "1"'
require_php_text 'install -m 600 /dev/null .env'
require_php_text 'php artisan wayfinder:generate --with-form --no-interaction'
require_php_text 'artifacts:'
require_php_text 'proxy/resources/js/actions'
require_php_text 'proxy/resources/js/routes'
require_php_text 'proxy/resources/js/wayfinder'

require_frontend_text() {
    text=$1
    if ! printf '%s\n' "$frontend_job" | grep -F "$text" > /dev/null; then
        printf 'Missing frontend-check contract: %s\n' "$text" >&2
        exit 1
    fi
}

require_frontend_text 'needs:'
require_frontend_text 'job: php-check'
require_frontend_text 'artifacts: true'
require_frontend_text 'image: oven/bun:1.3.14-alpine'

if printf '%s\n' "$frontend_job" | grep -F 'docker:' > /dev/null; then
    printf 'frontend-check must remain compatible with GitLab Runner 15.4\n' >&2
    exit 1
fi

if grep -E 'deploy:prod|CI_COMMIT_TAG|environment:[[:space:]]*production' "$ci_file" > /dev/null; then
    printf 'Production behavior must not exist in .gitlab-ci.yml\n' >&2
    exit 1
fi

if grep -F 'StrictHostKeyChecking=no' "$ci_file" > /dev/null; then
    printf 'Host key verification must not be disabled\n' >&2
    exit 1
fi
