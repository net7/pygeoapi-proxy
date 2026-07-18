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

if grep -E 'deploy:prod|CI_COMMIT_TAG|environment:[[:space:]]*production' "$ci_file" > /dev/null; then
    printf 'Production behavior must not exist in .gitlab-ci.yml\n' >&2
    exit 1
fi

if grep -F 'StrictHostKeyChecking=no' "$ci_file" > /dev/null; then
    printf 'Host key verification must not be disabled\n' >&2
    exit 1
fi
