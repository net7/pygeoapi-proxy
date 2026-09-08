# First Staging Deploy Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline on `develop`. Do not create a worktree and do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparare e verificare il bootstrap monouso di `deploy-dev-staging.sh`, quindi completare il primo merge `develop` → `staging` e il relativo deploy automatico senza un primo job fallito.

**Architecture:** Il server estrae un `deploy-dev-staging.sh` non tracciato dall'esatto SHA sorgente della Merge Request tramite il remote SSH read-only già autenticato. Il primo job automatico usa quel bootstrap per scaricare il merge commit, verificarne l'appartenenza a `origin/staging`, sostituire il bootstrap con la versione tracciata tramite `git checkout -f` e rilanciarsi. GitLab crea e accetta la MR tramite API, usando il parametro `sha` come guardia atomica contro modifiche concorrenti di `develop`.

**Tech Stack:** Bash/POSIX shell, Git, GitLab 18.x REST API tramite `glab`, GitLab CI/CD, Docker Compose, GNU Make, Curl, ShellCheck.

---

## File map

- Modify `deploy/tests/deploy-script.sh`: caratterizzare il caso in cui il
  checkout precedente non contiene `deploy-dev-staging.sh` e il bootstrap è non tracciato.
- Create `deploy/tests/bootstrap-runbook.sh`: contratto eseguibile per la
  procedura monouso e le verifiche post-deploy.
- Modify `deploy/tests/run.sh`: includere il nuovo contratto nella suite.
- Modify `deploy/README.md`: sostituire il vecchio primo deploy manuale con il
  bootstrap pre-merge, la recovery e la verifica del primo deploy automatico.
- No changes to `.gitlab-ci.yml`, `deploy-dev-staging.sh`, application code, Compose files,
  or `.env.staging`.
- External state: create one GitLab Merge Request, prepare one untracked server
  file, merge with a source-SHA guard, and observe the first staging pipeline.

### Task 1: Characterize the self-consuming bootstrap

**Files:**
- Modify: `deploy/tests/deploy-script.sh:14-39`
- Modify: `deploy/tests/deploy-script.sh:109-135`
- Test: `deploy/tests/deploy-script.sh`

- [ ] **Step 1: Add a staging baseline that does not contain `deploy-dev-staging.sh`**

Insert the following immediately after the Git identity configuration and
before the existing `deploy-dev-staging.sh` copy:

```sh
printf '.env.staging\n' > "$seed_repository/.gitignore"
printf 'staging baseline without deploy script\n' > "$seed_repository/README.md"
git -C "$seed_repository" add .gitignore README.md
git -C "$seed_repository" commit -q -m 'add staging bootstrap baseline'
git -C "$seed_repository" branch -M staging
git -C "$seed_repository" push -q -u origin staging
bootstrap_sha=$(git -C "$seed_repository" rev-parse HEAD)
```

Replace the current first deploy-script commit block with:

```sh
cp "$repository_root/deploy-dev-staging.sh" "$seed_repository/deploy-dev-staging.sh"
chmod +x "$seed_repository/deploy-dev-staging.sh"
git -C "$seed_repository" add deploy-dev-staging.sh
git -C "$seed_repository" commit -q -m 'add deploy script'
git -C "$seed_repository" push -q origin staging
previous_sha=$(git -C "$seed_repository" rev-parse HEAD)
```

This preserves every existing test at `previous_sha` while retaining an older
reachable staging commit where `deploy-dev-staging.sh` is absent.

- [ ] **Step 2: Add the bootstrap deployment scenario**

Insert this block after the existing successful deployment assertions and
before `failing_checkout`:

```sh
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
```

- [ ] **Step 3: Run the focused characterization test**

Run:

```bash
sh deploy/tests/deploy-script.sh
```

Expected: exit `0`. The scenario proves that the actual `deploy-dev-staging.sh` can start
untracked, check out a descendant where it is tracked, re-execute, and finish
with a clean working tree.

- [ ] **Step 4: Verify shell syntax and ShellCheck**

Run:

```bash
sh -n deploy/tests/deploy-script.sh
docker run --rm \
  -v /Users/nicola/Desktop/repository/pygeoapi-proxy:/work:ro \
  koalaman/shellcheck:stable \
  /work/deploy/tests/deploy-script.sh
```

Expected: both commands exit `0` with no ShellCheck findings.

- [ ] **Step 5: Commit the regression coverage**

```bash
git add deploy/tests/deploy-script.sh
git commit -m "test: cover first staging deploy bootstrap"
```

### Task 2: Add a tested bootstrap runbook

**Files:**
- Create: `deploy/tests/bootstrap-runbook.sh`
- Modify: `deploy/tests/run.sh:7-16`
- Modify: `deploy/README.md:132-148`
- Test: `deploy/tests/bootstrap-runbook.sh`
- Test: `deploy/tests/run.sh`

- [ ] **Step 1: Create the failing runbook contract**

Create `deploy/tests/bootstrap-runbook.sh` with this exact content and make it
executable:

```sh
#!/bin/sh

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
require_text 'git -C "$DEPLOY_PATH" show "${SOURCE_SHA}:deploy-dev-staging.sh"'
require_text 'ACTUAL_BLOB=$(git -C "$DEPLOY_PATH" hash-object "$TEMPORARY_SCRIPT")'
require_text 'bash -n "$TEMPORARY_SCRIPT"'
require_text '?? deploy-dev-staging.sh'
require_text 'git ls-files --error-unmatch deploy-dev-staging.sh'
require_text '## Verifica del primo deploy automatico'
require_text 'https://proxygeoapi.netseven.work/up'
```

Run:

```bash
chmod +x deploy/tests/bootstrap-runbook.sh
sh deploy/tests/bootstrap-runbook.sh
```

Expected: exit `1` with
`Missing bootstrap runbook contract: ## Bootstrap del primo deploy automatico`.

- [ ] **Step 2: Add the contract to the full suite**

Add `bootstrap-runbook.sh` after `deploy-script.sh` in
`deploy/tests/run.sh`:

```sh
    deploy-script.sh \
    bootstrap-runbook.sh \
    gitlab-ci.sh
```

- [ ] **Step 3: Replace the old supervised first-deploy section**

Replace `## Primo deploy sorvegliato` through the paragraph immediately before
`## Deploy automatico` in `deploy/README.md` with the following content:

````markdown
## Bootstrap del primo deploy automatico

Questa procedura si usa una sola volta, perché l'attuale `staging` non contiene
ancora `deploy-dev-staging.sh`. Prima di eseguirla, creare la Merge Request da `develop` a
`staging`, attendere il successo dei quality gate e non effettuare ancora il
merge.

Come amministratore del server, installare il bootstrap dall'esatto head
autenticato di `develop`:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail

DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
TEMPORARY_SCRIPT=
BOOTSTRAP_INSTALLED=0

cleanup() {
    if [ -n "$TEMPORARY_SCRIPT" ]; then
        rm -f -- "$TEMPORARY_SCRIPT"
    fi
    if [ "$BOOTSTRAP_INSTALLED" -eq 1 ] &&
        ! git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy-dev-staging.sh \
            > /dev/null 2>&1
    then
        rm -f -- "$DEPLOY_PATH/deploy-dev-staging.sh"
    fi
}

trap cleanup EXIT

git -C "$DEPLOY_PATH" fetch origin --tags --prune
SOURCE_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/develop^{commit}')
STAGING_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/staging^{commit}')
CURRENT_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'HEAD^{commit}')

[ "$CURRENT_SHA" = "$STAGING_SHA" ] || {
    printf 'HEAD non coincide con origin/staging\n' >&2
    exit 1
}

[ -z "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=no)" ] || {
    printf 'Il checkout contiene modifiche a file versionati\n' >&2
    exit 1
}

git -C "$DEPLOY_PATH" check-ignore -q .env.staging
[ "$(stat -c '%a %U:%G' "$DEPLOY_PATH/.env.staging")" = \
    '600 gitlab_deploy:gitlab_deploy' ] || {
    printf '.env.staging ha owner o permessi inattesi\n' >&2
    exit 1
}

if git -C "$DEPLOY_PATH" cat-file -e 'HEAD:deploy-dev-staging.sh' 2>/dev/null; then
    printf 'deploy-dev-staging.sh è già tracciato nel commit corrente\n' >&2
    exit 1
fi

[ ! -e "$DEPLOY_PATH/deploy-dev-staging.sh" ] || {
    printf 'deploy-dev-staging.sh esiste già nel working tree\n' >&2
    exit 1
}

TEMPORARY_SCRIPT=$(mktemp "$DEPLOY_PATH/.deploy-dev-staging.sh.bootstrap.XXXXXX")
git -C "$DEPLOY_PATH" show "${SOURCE_SHA}:deploy-dev-staging.sh" > "$TEMPORARY_SCRIPT"

EXPECTED_BLOB=$(git -C "$DEPLOY_PATH" rev-parse "${SOURCE_SHA}:deploy-dev-staging.sh")
ACTUAL_BLOB=$(git -C "$DEPLOY_PATH" hash-object "$TEMPORARY_SCRIPT")
[ "$ACTUAL_BLOB" = "$EXPECTED_BLOB" ] || {
    printf 'Blob bootstrap inatteso\n' >&2
    exit 1
}

bash -n "$TEMPORARY_SCRIPT"
chmod 0755 "$TEMPORARY_SCRIPT"
mv -- "$TEMPORARY_SCRIPT" "$DEPLOY_PATH/deploy-dev-staging.sh"
TEMPORARY_SCRIPT=
BOOTSTRAP_INSTALLED=1

VISIBLE_STATUS=$(
    git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all
)
[ "$VISIBLE_STATUS" = '?? deploy-dev-staging.sh' ] || {
    printf 'Stato working tree inatteso:\n%s\n' "$VISIBLE_STATUS" >&2
    exit 1
}

[ "$(git -C "$DEPLOY_PATH" hash-object "$DEPLOY_PATH/deploy-dev-staging.sh")" = \
    "$EXPECTED_BLOB" ]
stat -c '%a %U:%G %n' "$DEPLOY_PATH/deploy-dev-staging.sh"
printf 'BOOTSTRAP_SOURCE_SHA=%s\n' "$SOURCE_SHA"
printf 'BOOTSTRAP_BLOB_SHA=%s\n' "$EXPECTED_BLOB"
printf '%s\n' "$VISIBLE_STATUS"

trap - EXIT
BASH
```

`BOOTSTRAP_SOURCE_SHA` deve coincidere con lo SHA sorgente della MR e con
`refs/heads/develop` immediatamente prima del merge. Se non coincide, non fare
merge. Rimuovere soltanto il bootstrap non tracciato con:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail
DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
if git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy-dev-staging.sh \
    > /dev/null 2>&1
then
    printf 'deploy-dev-staging.sh è tracciato: rimozione rifiutata\n' >&2
    exit 1
fi
[ "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all)" = \
    '?? deploy-dev-staging.sh' ]
rm -- "$DEPLOY_PATH/deploy-dev-staging.sh"
BASH
```

Il bootstrap non cambia HEAD, non avvia container e non legge il contenuto di
`.env.staging`. Il primo job automatico lo sostituisce con il file tracciato del
merge commit tramite `git checkout -f`.

## Verifica del primo deploy automatico

Dopo che la pipeline push di `staging` e il job `deploy:staging` sono terminati
con successo, eseguire:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail
DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
git -C "$DEPLOY_PATH" fetch origin --tags --prune
HEAD_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'HEAD^{commit}')
STAGING_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/staging^{commit}')
[ "$HEAD_SHA" = "$STAGING_SHA" ]
git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy-dev-staging.sh > /dev/null
[ -z "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all)" ]
git -C "$DEPLOY_PATH" check-ignore -q .env.staging
[ "$(stat -c '%a %U:%G' "$DEPLOY_PATH/.env.staging")" = \
    '600 gitlab_deploy:gitlab_deploy' ]
make -C "$DEPLOY_PATH" --no-print-directory ENV=staging deploy-status
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
printf 'DEPLOYED_SHA=%s\n' "$HEAD_SHA"
BASH
curl --fail --silent --show-error \
  https://proxygeoapi.netseven.work/up > /dev/null
```

Lo SHA `DEPLOYED_SHA` deve coincidere con `merge_commit_sha` della Merge
Request e con lo SHA della pipeline push di `staging`. `deploy-dev-staging.sh` deve essere
tracciato e il working tree deve essere pulito.
````

- [ ] **Step 4: Run the focused runbook contract**

```bash
sh deploy/tests/bootstrap-runbook.sh
```

Expected: exit `0` with no output.

- [ ] **Step 5: Run the full deployment suite and shell checks**

```bash
bash deploy/tests/run.sh
bash -n deploy-dev-staging.sh deploy/tests/*.sh
docker run --rm \
  -v /Users/nicola/Desktop/repository/pygeoapi-proxy:/work:ro \
  koalaman/shellcheck:stable \
  /work/deploy-dev-staging.sh \
  /work/deploy/tests/compose-oauth-env.sh \
  /work/deploy/tests/compose-staging-automation.sh \
  /work/deploy/tests/deploy-script.sh \
  /work/deploy/tests/bootstrap-runbook.sh \
  /work/deploy/tests/gitlab-ci.sh \
  /work/deploy/tests/makefile-deploy.sh \
  /work/deploy/tests/run.sh
```

Expected: the suite ends with `All deployment tests passed.`; syntax and
ShellCheck exit `0` without findings.

- [ ] **Step 6: Commit the runbook and its contract**

```bash
git add deploy/README.md deploy/tests/bootstrap-runbook.sh deploy/tests/run.sh
git commit -m "docs: add first staging deploy bootstrap runbook"
```

### Task 3: Verify and publish the repository changes

**Files:**
- Verify: `.gitlab-ci.yml`
- Verify: `deploy-dev-staging.sh`
- Verify: `deploy/README.md`
- Verify: `deploy/tests/*.sh`

- [ ] **Step 1: Run the final local verification**

```bash
bash deploy/tests/run.sh
bash -n deploy-dev-staging.sh deploy/tests/*.sh
git diff --check
git status --short --branch
```

Expected: all tests pass, syntax exits `0`, `git diff --check` is empty, and
the branch is ahead only by the two intended implementation commits.

- [ ] **Step 2: Validate the GitLab CI configuration through the instance**

```bash
jq -Rs '{content: .}' .gitlab-ci.yml |
  glab api --method POST 'projects/737/ci/lint' --input - |
  jq -e '.valid == true and (.errors | length == 0)'
```

Expected: output `true` and exit `0`.

- [ ] **Step 3: Push `develop` and verify synchronization**

```bash
git push origin develop
git fetch origin develop staging
git rev-parse develop
git rev-parse origin/develop
git rev-list --left-right --count origin/develop...develop
```

Expected: the two SHA values are identical and divergence is `0 0`.

### Task 4: Create the Merge Request and wait for quality gates

**External state:**
- GitLab project: `net7-main/ingv/pygeoapi-proxy` (`737`)
- Source branch: `develop`
- Target branch: `staging`
- Do not merge in this task.

- [ ] **Step 1: Create or reuse exactly one open Merge Request**

Run from the repository root:

```bash
set -Eeuo pipefail
PROJECT_ID=737
OPEN_MRS=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=opened&source_branch=develop&target_branch=staging")
MR_COUNT=$(printf '%s' "$OPEN_MRS" | jq 'length')

case "$MR_COUNT" in
  0)
    MR_DESCRIPTION=$(printf '%s\n' \
      '## Obiettivo' \
      'Abilitare CI/CD e deploy automatico esclusivamente per staging.' \
      '' \
      '## Primo deploy' \
      '- quality gate MR prima del merge' \
      '- bootstrap server pinning allo SHA sorgente' \
      '- merge protetto dalla guardia SHA API' \
      '- deploy automatico al primo tentativo' \
      '' \
      '## Escluso' \
      '- altri ambienti di deploy' \
      '- push diretti a staging' \
      '- rollback automatico delle migrazioni')
    MR=$(glab api --method POST "projects/$PROJECT_ID/merge_requests" \
      -f source_branch=develop \
      -f target_branch=staging \
      -f title='Enable staging CI/CD deployment' \
      -f description="$MR_DESCRIPTION" \
      -f remove_source_branch=false \
      -f squash=false)
    ;;
  1)
    MR=$(printf '%s' "$OPEN_MRS" | jq '.[0]')
    ;;
  *)
    printf 'Più MR develop -> staging aperte; operazione interrotta\n' >&2
    exit 1
    ;;
esac

printf '%s' "$MR" | jq '{iid, sha, state, source_branch, target_branch, web_url}'
```

Expected: one opened MR with source `develop`, target `staging`, and a direct
`web_url`. Each following command resolves that single open MR again, so it
does not depend on shell variables left by a previous step.

- [ ] **Step 2: Wait for the Merge Request pipeline**

Poll no longer than ten minutes, reporting status at least once per minute:

```bash
PROJECT_ID=737
MR_IID=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=opened&source_branch=develop&target_branch=staging" |
  jq -er 'if length == 1 then .[0].iid else error("Expected exactly one open develop -> staging MR") end')

for attempt in $(seq 1 60); do
  PIPELINES=$(glab api \
    "projects/$PROJECT_ID/merge_requests/$MR_IID/pipelines?per_page=100")
  PIPELINE=$(printf '%s' "$PIPELINES" | jq 'max_by(.id)')
  PIPELINE_ID=$(printf '%s' "$PIPELINE" | jq -r '.id // empty')
  PIPELINE_STATUS=$(printf '%s' "$PIPELINE" | jq -r '.status // "pending"')
  printf 'MR pipeline %s: %s\n' "${PIPELINE_ID:-not-created}" "$PIPELINE_STATUS"
  case "$PIPELINE_STATUS" in
    success) break ;;
    failed|canceled|skipped|manual)
      printf 'MR pipeline non riuscita\n' >&2
      exit 1
      ;;
  esac
  sleep 10
done
[ "$PIPELINE_STATUS" = success ]
```

- [ ] **Step 3: Verify all three quality jobs and pin the source SHA**

```bash
PROJECT_ID=737
MR=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=opened&source_branch=develop&target_branch=staging" |
  jq -er 'if length == 1 then .[0] else error("Expected exactly one open develop -> staging MR") end')
MR_IID=$(printf '%s' "$MR" | jq -r '.iid')
MR=$(glab api "projects/$PROJECT_ID/merge_requests/$MR_IID")
PIPELINE_ID=$(glab api \
  "projects/$PROJECT_ID/merge_requests/$MR_IID/pipelines?per_page=100" |
  jq -er 'max_by(.id).id')

JOBS=$(glab api "projects/$PROJECT_ID/pipelines/$PIPELINE_ID/jobs?per_page=100")
printf '%s' "$JOBS" | jq -e '
  [.[] | select(
    .name == "deployment-check" or
    .name == "php-check" or
    .name == "frontend-check"
  )] as $jobs |
  ($jobs | length) == 3 and all($jobs[]; .status == "success")
'

MR_SOURCE_SHA=$(printf '%s' "$MR" | jq -r '.sha')
REMOTE_DEVELOP_SHA=$(git ls-remote origin refs/heads/develop | awk '{print $1}')
[ "$MR_SOURCE_SHA" = "$REMOTE_DEVELOP_SHA" ]
printf 'MR_SOURCE_SHA=%s\n' "$MR_SOURCE_SHA"
```

Expected: `true`, three successful jobs, and identical 40-character source
SHAs. Do not merge yet.

### Task 5: Install the one-time bootstrap on the server

**External state:**
- Host: `91.107.228.84:1024`
- Administrative session: existing root shell supplied by the operator
- Checkout: `/docker-data/configuration/pygeoapi-proxy`
- Runtime account: `gitlab_deploy`

- [ ] **Step 1: Execute the runbook bootstrap command on the server**

Copy the complete command under `## Bootstrap del primo deploy automatico` from
`deploy/README.md` and run it once in the existing administrative shell.

Expected final output contains `BOOTSTRAP_SOURCE_SHA=` and
`BOOTSTRAP_BLOB_SHA=`, each followed by exactly 40 lowercase hexadecimal
characters, plus the exact Git status line `?? deploy-dev-staging.sh`.

It must also report mode `755`, owner `gitlab_deploy:gitlab_deploy`, and the
path `/docker-data/configuration/pygeoapi-proxy/deploy-dev-staging.sh`. It must not run
Docker or change server HEAD.

- [ ] **Step 2: Compare the server SHA to GitLab and the remote**

Immediately re-read both values locally:

```bash
PROJECT_ID=737
MR=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=opened&source_branch=develop&target_branch=staging" |
  jq -er 'if length == 1 then .[0] else error("Expected exactly one open develop -> staging MR") end')
MR_IID=$(printf '%s' "$MR" | jq -r '.iid')
MR=$(glab api "projects/$PROJECT_ID/merge_requests/$MR_IID")
MR_SOURCE_SHA=$(printf '%s' "$MR" | jq -r '.sha')
REMOTE_DEVELOP_SHA=$(git ls-remote origin refs/heads/develop | awk '{print $1}')
[ "$MR_SOURCE_SHA" = "$REMOTE_DEVELOP_SHA" ]
printf 'EXPECTED_BOOTSTRAP_SOURCE_SHA=%s\n' "$MR_SOURCE_SHA"
```

Expected: `EXPECTED_BOOTSTRAP_SOURCE_SHA` exactly equals the server's
`BOOTSTRAP_SOURCE_SHA`. If it differs, execute only the guarded removal command
from the runbook and repeat Task 5 with the new source SHA.

- [ ] **Step 3: Re-read merge readiness without changing state**

```bash
PROJECT_ID=737
MR_IID=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=opened&source_branch=develop&target_branch=staging" |
  jq -er 'if length == 1 then .[0].iid else error("Expected exactly one open develop -> staging MR") end')
glab api "projects/$PROJECT_ID/merge_requests/$MR_IID" |
  jq '{iid, sha, state, detailed_merge_status, has_conflicts, head_pipeline}'
```

Expected: state `opened`, `has_conflicts: false`, source SHA unchanged, and
head pipeline status `success`. Accept `detailed_merge_status` only when GitLab
reports the MR as mergeable; otherwise stop and diagnose without merging.

### Task 6: Merge with a SHA guard and monitor the first deployment

**External state:**
- Mutates `staging` only through the approved Merge Request.
- Must preserve `develop`.
- Must not create or modify state outside staging.

- [ ] **Step 1: Accept the Merge Request atomically**

```bash
set -Eeuo pipefail
PROJECT_ID=737
: "${BOOTSTRAP_SOURCE_SHA:?Export the exact BOOTSTRAP_SOURCE_SHA reported by the server}"
[[ "$BOOTSTRAP_SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]

MR=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=opened&source_branch=develop&target_branch=staging" |
  jq -er 'if length == 1 then .[0] else error("Expected exactly one open develop -> staging MR") end')
MR_IID=$(printf '%s' "$MR" | jq -r '.iid')
MR=$(glab api "projects/$PROJECT_ID/merge_requests/$MR_IID")
SOURCE_SHA=$(printf '%s' "$MR" | jq -r '.sha')
PIPELINE_STATUS=$(printf '%s' "$MR" | jq -r '.head_pipeline.status')
REMOTE_DEVELOP_SHA=$(git ls-remote origin refs/heads/develop | awk '{print $1}')
[ "$SOURCE_SHA" = "$BOOTSTRAP_SOURCE_SHA" ]
[ "$SOURCE_SHA" = "$REMOTE_DEVELOP_SHA" ]
[ "$PIPELINE_STATUS" = success ]

MERGE=$(glab api --method PUT \
  "projects/$PROJECT_ID/merge_requests/$MR_IID/merge" \
  -f sha="$SOURCE_SHA" \
  -f should_remove_source_branch=false \
  -f squash=false)

printf '%s' "$MERGE" |
  jq -e '.state == "merged" and .merge_commit_sha != null'
MERGE_SHA=$(printf '%s' "$MERGE" | jq -r '.merge_commit_sha')
printf 'MERGE_SHA=%s\n' "$MERGE_SHA"
git ls-remote --exit-code origin refs/heads/develop
```

Expected: merge succeeds, a non-null `MERGE_SHA` is printed, and `develop`
still exists. Set `BOOTSTRAP_SOURCE_SHA` only from the server output collected
in Task 5. A GitLab `409` or SHA mismatch means no merge occurred: remove the
old bootstrap with the guarded runbook command and return to Task 4.

- [ ] **Step 2: Locate the push pipeline for the merge commit**

```bash
PROJECT_ID=737
MERGED_MR=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=merged&source_branch=develop&target_branch=staging&order_by=updated_at&sort=desc&per_page=1" |
  jq -er '.[0]')
MERGE_SHA=$(printf '%s' "$MERGED_MR" | jq -r '.merge_commit_sha')
REMOTE_STAGING_SHA=$(git ls-remote origin refs/heads/staging | awk '{print $1}')
[ "$MERGE_SHA" = "$REMOTE_STAGING_SHA" ]

for attempt in $(seq 1 30); do
  PIPELINES=$(glab api \
    "projects/$PROJECT_ID/pipelines?sha=$MERGE_SHA&ref=staging&source=push&per_page=20")
  PUSH_PIPELINE=$(printf '%s' "$PIPELINES" | jq 'max_by(.id)')
  PUSH_PIPELINE_ID=$(printf '%s' "$PUSH_PIPELINE" | jq -r '.id // empty')
  [ -n "$PUSH_PIPELINE_ID" ] && break
  printf 'Attendo la pipeline push di staging\n'
  sleep 5
done
[ -n "$PUSH_PIPELINE_ID" ]
printf 'PUSH_PIPELINE_ID=%s\n' "$PUSH_PIPELINE_ID"
```

- [ ] **Step 3: Monitor the first push pipeline to completion**

Poll at ten-second intervals, reporting status at least once per minute:

```bash
PROJECT_ID=737
MERGE_SHA=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=merged&source_branch=develop&target_branch=staging&order_by=updated_at&sort=desc&per_page=1" |
  jq -er '.[0].merge_commit_sha')
PUSH_PIPELINE_ID=$(glab api \
  "projects/$PROJECT_ID/pipelines?sha=$MERGE_SHA&ref=staging&source=push&per_page=20" |
  jq -er 'max_by(.id).id')

for attempt in $(seq 1 180); do
  PUSH_PIPELINE=$(glab api "projects/$PROJECT_ID/pipelines/$PUSH_PIPELINE_ID")
  PUSH_STATUS=$(printf '%s' "$PUSH_PIPELINE" | jq -r '.status')
  printf 'Staging pipeline %s: %s\n' "$PUSH_PIPELINE_ID" "$PUSH_STATUS"
  case "$PUSH_STATUS" in
    success) break ;;
    failed|canceled|skipped|manual)
      glab api "projects/$PROJECT_ID/pipelines/$PUSH_PIPELINE_ID/jobs?per_page=100" |
        jq '[.[] | {id, name, status, web_url}]'
      printf 'Prima pipeline staging non riuscita\n' >&2
      exit 1
      ;;
  esac
  sleep 10
done
[ "$PUSH_STATUS" = success ]
```

Do not run a manual deployment while this pipeline is pending or running.

- [ ] **Step 4: Verify every push-pipeline job, including deploy**

```bash
PROJECT_ID=737
MERGE_SHA=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=merged&source_branch=develop&target_branch=staging&order_by=updated_at&sort=desc&per_page=1" |
  jq -er '.[0].merge_commit_sha')
PUSH_PIPELINE_ID=$(glab api \
  "projects/$PROJECT_ID/pipelines?sha=$MERGE_SHA&ref=staging&source=push&per_page=20" |
  jq -er 'max_by(.id).id')

PUSH_JOBS=$(glab api \
  "projects/$PROJECT_ID/pipelines/$PUSH_PIPELINE_ID/jobs?per_page=100")
printf '%s' "$PUSH_JOBS" | jq -e '
  [.[] | select(
    .name == "deployment-check" or
    .name == "php-check" or
    .name == "frontend-check" or
    .name == "deploy:staging"
  )] as $jobs |
  ($jobs | length) == 4 and all($jobs[]; .status == "success")
'
```

Expected: `true`; all four jobs succeeded in the first push pipeline.

### Task 7: Verify the deployed server and close the bootstrap

**External state:**
- Read-only verification after the successful deploy.
- No cleanup command should be needed because `deploy-dev-staging.sh` is now tracked.

- [ ] **Step 1: Run the post-deploy server verification**

Copy and execute the complete command under
`## Verifica del primo deploy automatico` in `deploy/README.md`.

Expected:

- `DEPLOYED_SHA` is printed;
- `deploy-dev-staging.sh` is tracked;
- the working tree is clean;
- `.env.staging` remains ignored with mode `600` and owner
  `gitlab_deploy:gitlab_deploy`;
- Laravel and Reverb are healthy;
- the loopback and public `/up` requests both exit `0`.

- [ ] **Step 2: Compare server, merge, and pipeline SHAs**

```bash
PROJECT_ID=737
MERGE_SHA=$(glab api \
  "projects/$PROJECT_ID/merge_requests?state=merged&source_branch=develop&target_branch=staging&order_by=updated_at&sort=desc&per_page=1" |
  jq -er '.[0].merge_commit_sha')
PUSH_PIPELINE_ID=$(glab api \
  "projects/$PROJECT_ID/pipelines?sha=$MERGE_SHA&ref=staging&source=push&per_page=20" |
  jq -er 'max_by(.id).id')
PIPELINE_SHA=$(glab api "projects/$PROJECT_ID/pipelines/$PUSH_PIPELINE_ID" | jq -r '.sha')
[ "$PIPELINE_SHA" = "$MERGE_SHA" ]
printf 'EXPECTED_DEPLOYED_SHA=%s\n' "$MERGE_SHA"
```

Expected: `EXPECTED_DEPLOYED_SHA` exactly equals the server's `DEPLOYED_SHA`.

- [ ] **Step 3: Verify GitLab branch and project protections remain intact**

```bash
glab api 'projects/737' |
  jq '{only_allow_merge_if_pipeline_succeeds, merge_method}'
glab api 'projects/737/protected_branches/staging' |
  jq '{name, push_access_levels, merge_access_levels, allow_force_push}'
```

Expected:

- `only_allow_merge_if_pipeline_succeeds: true`;
- merge method remains `merge`;
- staging push access is `No one` (`access_level: 0`);
- force push is disabled;
- merge access remains limited to the configured project roles.

- [ ] **Step 4: Record final repository synchronization**

```bash
git fetch origin develop staging
git status --short --branch
git rev-parse origin/develop
git rev-parse origin/staging
```

Expected: local `develop` remains clean and synchronized. Report the MR URL,
MR source SHA, merge SHA, push pipeline URL, deployed SHA, and verification
results. Do not modify `main`.
