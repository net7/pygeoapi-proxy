#!/bin/sh

set -eu

tests_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

for test_script in \
    compose-oauth-env.sh \
    makefile-deploy.sh \
    compose-staging-automation.sh \
    deploy-script.sh \
    bootstrap-runbook.sh \
    gitlab-ci.sh
do
    printf '\n==> %s\n' "$test_script"
    "$tests_directory/$test_script"
done

printf '\nAll deployment tests passed.\n'
