# Staging Non-Standard SSH Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline on `develop`. Do not create a worktree and do not dispatch subagents.

**Goal:** Make the staging deploy use SSH port `1024`, verify the existing `gitlab_deploy` identity, configure all protected GitLab variables, and document its supervised SSH bootstrap.

**Architecture:** Keep the server-side `deploy-dev-staging.sh` interface unchanged and add the port only at the GitLab Runner-to-server SSH boundary. Store host, port, user, path, private key, and verified host key as protected variables scoped to `staging`; reject invalid port values before networking. Generate key material outside the repository, upload the private portion without logging it, and stop before any server mutation or `develop` to `staging` merge.

**Tech Stack:** GitLab CI/CD YAML, POSIX shell, OpenSSH (`ssh`, `ssh-keygen`, `ssh-keyscan`, `ssh-copy-id`), `glab` REST API, ShellCheck, existing shell contract tests.

---

## File map

- Modify `.gitlab-ci.yml`: validate `DEPLOY_PORT` and pass it to the SSH client.
- Modify `deploy/tests/gitlab-ci.sh`: contract-test the new variable, validation messages, and SSH invocation.
- Modify `deploy/README.md`: document port `1024`, the sixth GitLab variable, verified fingerprint, and supervised `gitlab_deploy` SSH bootstrap.
- No application, Compose, Laravel, or server-side `deploy-dev-staging.sh` behavior changes.
- No key material is created under the repository root.

### Task 1: Add the staging SSH port contract with TDD

**Files:**
- Modify: `deploy/tests/gitlab-ci.sh:35-39`
- Test: `deploy/tests/gitlab-ci.sh`

- [ ] **Step 1: Add failing CI contract assertions**

Add these assertions after the existing SSH-variable assertions:

```sh
require_text 'DEPLOY_PORT'
require_text 'DEPLOY_PORT must contain only decimal digits'
require_text 'DEPLOY_PORT must be between 1 and 65535'
require_text 'ssh -p "$DEPLOY_PORT"'
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
bash deploy/tests/gitlab-ci.sh
```

Expected: exit `1` with `Missing GitLab CI contract: DEPLOY_PORT`, proving the
current pipeline does not yet support a configurable port.

- [ ] **Step 3: Implement the minimal port validation and SSH option**

In `.gitlab-ci.yml`, insert this block before `DEPLOY_PATH` validation:

```yaml
      case "$DEPLOY_PORT" in
        ''|*[!0-9]*) printf '%s\n' 'DEPLOY_PORT must contain only decimal digits' >&2; exit 1 ;;
      esac
      if [ "${#DEPLOY_PORT}" -gt 5 ] || [ "$DEPLOY_PORT" -lt 1 ] || [ "$DEPLOY_PORT" -gt 65535 ]; then
        printf '%s\n' 'DEPLOY_PORT must be between 1 and 65535' >&2
        exit 1
      fi
```

Change the final invocation to:

```yaml
      ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEPLOY_PATH' && ./deploy-dev-staging.sh staging '$CI_COMMIT_SHA'"
```

Do not default to port `22`: a missing variable must fail clearly.

- [ ] **Step 4: Run focused and full deployment tests**

Run:

```bash
bash deploy/tests/gitlab-ci.sh
bash deploy/tests/run.sh
bash -n deploy-dev-staging.sh deploy/tests/*.sh
```

Expected: all commands exit `0`; the full suite ends with
`All deployment tests passed.`

- [ ] **Step 5: Run ShellCheck against the deploy scripts**

Run:

```bash
docker run --rm \
  -v /Users/nicola/Desktop/repository/pygeoapi-proxy:/work:ro \
  koalaman/shellcheck:stable \
  /work/deploy-dev-staging.sh \
  /work/deploy/tests/compose-oauth-env.sh \
  /work/deploy/tests/compose-staging-automation.sh \
  /work/deploy/tests/deploy-script.sh \
  /work/deploy/tests/gitlab-ci.sh \
  /work/deploy/tests/makefile-deploy.sh \
  /work/deploy/tests/run.sh
```

Expected: exit `0` with no ShellCheck findings.

- [ ] **Step 6: Commit the tested CI change**

```bash
git add .gitlab-ci.yml deploy/tests/gitlab-ci.sh
git commit -m "ci: support staging SSH port variable"
```

### Task 2: Document the port and supervised server bootstrap

**Files:**
- Modify: `deploy/README.md:17-110`
- Modify: `deploy/README.md:154-170`

- [ ] **Step 1: Add the concrete SSH endpoint to topology and prerequisites**

Document these staging values near the topology:

```text
- SSH endpoint: `91.107.228.84:1024`
- SSH host-key fingerprint: `SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI`
```

Add account checks before checkout checks:

```bash
getent passwd gitlab_deploy
id gitlab_deploy
sudo -u gitlab_deploy sh -lc 'printf "home=%s\n" "$HOME"; id; command -v git docker make curl flock'
```

State explicitly that the pipeline does not create or modify the account.

- [ ] **Step 2: Document the confirmed account and required permissions**

Document that `gitlab_deploy` already exists and must retain membership in the
`docker` and `www-data` groups. Prepare its SSH directory without replacing
existing authorized keys:

```bash
sudo install -d -m 0700 -o gitlab_deploy -g gitlab_deploy /home/gitlab_deploy/.ssh
sudo touch /home/gitlab_deploy/.ssh/authorized_keys
sudo chown gitlab_deploy:gitlab_deploy /home/gitlab_deploy/.ssh/authorized_keys
sudo chmod 0600 /home/gitlab_deploy/.ssh/authorized_keys
```

Do not grant passwordless sudo and do not overwrite existing keys.

- [ ] **Step 3: Update every workstation SSH command for port `1024`**

Use:

```bash
DEPLOY_HOST=91.107.228.84
DEPLOY_PORT=1024
ssh-copy-id -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging.pub "gitlab_deploy@$DEPLOY_HOST"
ssh-keyscan -H -p "$DEPLOY_PORT" -t ed25519 "$DEPLOY_HOST" > ./pygeoapi-proxy-staging.known_hosts
ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts
ssh -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging "gitlab_deploy@$DEPLOY_HOST" true
```

The documented fingerprint must exactly match the administrator-supplied
SHA256 fingerprint before the known-hosts file is uploaded.

- [ ] **Step 4: Add `DEPLOY_PORT` to the variables table and diagnostics**

Add:

```markdown
| `DEPLOY_PORT` | Variable | Protected | `1024` |
```

Update the SSH-rejected diagnostic command to include
`-p "$DEPLOY_PORT"`.

- [ ] **Step 5: Check documentation hygiene and commit**

Run:

```bash
git diff --check
rg -n 'DEPLOY_PORT|91\.107\.228\.84:1024|3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI' deploy/README.md
```

Expected: `git diff --check` exits `0`; `rg` finds the port, endpoint, variable,
and fingerprint in the intended runbook sections.

Commit:

```bash
git add deploy/README.md
git commit -m "docs: add staging SSH bootstrap procedure"
```

### Task 3: Generate and authenticate staging SSH material

**Files:**
- Create temporarily outside repository: `/private/tmp/pygeoapi-staging-key.XXXXXX/id_ed25519`
- Create temporarily outside repository: `/private/tmp/pygeoapi-staging-key.XXXXXX/id_ed25519.pub`
- Create temporarily outside repository: `/private/tmp/pygeoapi-staging-key.XXXXXX/known_hosts`
- Do not modify tracked files.

- [ ] **Step 1: Create a protected temporary directory**

Run outside the default sandbox:

```bash
umask 077
staging_key_dir=$(mktemp -d /private/tmp/pygeoapi-staging-key.XXXXXX)
case "$staging_key_dir" in
  /private/tmp/pygeoapi-staging-key.*) ;;
  *) printf '%s\n' 'Unexpected temporary key path' >&2; exit 1 ;;
esac
chmod 0700 "$staging_key_dir"
printf '%s\n' "$staging_key_dir"
```

Keep this protected shell session open for Tasks 3 and 4. The validated
`staging_key_dir` value is the only directory used for key material.

- [ ] **Step 2: Generate the dedicated client key without printing it**

Using the exact temporary path returned in Step 1, run:

```bash
ssh-keygen -q -t ed25519 -a 100 -N '' \
  -C 'gitlab-pygeoapi-proxy-staging' \
  -f "$staging_key_dir/id_ed25519"
chmod 0600 "$staging_key_dir/id_ed25519"
chmod 0644 "$staging_key_dir/id_ed25519.pub"
ssh-keygen -lf "$staging_key_dir/id_ed25519.pub"
```

Expected: one `256 SHA256:...` Ed25519 public-key fingerprint. Never print the
private-key file.

- [ ] **Step 3: Scan and verify the server Ed25519 host key**

Run outside the default sandbox:

```bash
ssh-keyscan -H -p 1024 -t ed25519 91.107.228.84 \
  > "$staging_key_dir/known_hosts"
ssh-keygen -lf "$staging_key_dir/known_hosts"
```

Expected fingerprint, exactly:

```text
SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI
```

Stop without creating `DEPLOY_KNOWN_HOSTS` if it differs or the scan returns no
Ed25519 key.

- [ ] **Step 4: Retain the public key for the server handoff**

Read only the `.pub` file and provide its single `ssh-ed25519 ...
gitlab-pygeoapi-proxy-staging` line to the administrator. Also retain its
SHA256 fingerprint in the final handoff. Do not add the public key to the
repository.

### Task 4: Create the six protected GitLab variables

**Files:**
- Read temporary key files from Task 3.
- Do not modify tracked files.

- [ ] **Step 1: Verify authentication and current variable metadata**

Run:

```bash
glab auth status --hostname gitlab.netseven.it
glab api "projects/:fullpath/variables"
```

Filter any displayed response to these metadata fields only:
`key`, `variable_type`, `protected`, `masked`, `raw`, and
`environment_scope`. Never print `value`.

- [ ] **Step 2: Create or update simple variables by key and scope**

For each simple variable, first query
`GET /projects/:fullpath/variables/:key?filter[environment_scope]=staging`.
Use `POST /projects/:fullpath/variables` when absent and `PUT` on the filtered
key endpoint when present.

Send these exact values:

```text
DEPLOY_HOST=91.107.228.84
DEPLOY_PORT=1024
DEPLOY_USER=gitlab_deploy
DEPLOY_PATH=/docker-data/configuration/pygeoapi-proxy
```

Send these exact attributes with every variable:

```text
variable_type=env_var
protected=true
masked=false
raw=true
environment_scope=staging
```

- [ ] **Step 3: Create or update the File variables without logging values**

Apply the same scoped GET/POST/PUT decision for:

```text
DEPLOY_SSH_KEY       value=@$staging_key_dir/id_ed25519
DEPLOY_KNOWN_HOSTS   value=@$staging_key_dir/known_hosts
```

Use these attributes:

```text
variable_type=file
protected=true
masked=false
raw=true
environment_scope=staging
```

With `glab api`, pass each file through
`--field "value=@$staging_key_dir/id_ed25519"` or
`--field "value=@$staging_key_dir/known_hosts"` so the command line contains
only the validated file path, never the private value.

- [ ] **Step 4: Verify metadata and only then delete temporary secrets**

Fetch all project variables and emit only metadata. Expected: exactly these six
keys at scope `staging`, all protected; `DEPLOY_SSH_KEY` and
`DEPLOY_KNOWN_HOSTS` have type `file`, the other four have type `env_var`.

After verification, re-check the validated prefix and remove only the three
known files followed by the now-empty directory:

```bash
case "$staging_key_dir" in
  /private/tmp/pygeoapi-staging-key.*) ;;
  *) printf '%s\n' 'Refusing unsafe temporary key cleanup' >&2; exit 1 ;;
esac
rm -f -- \
  "$staging_key_dir/id_ed25519" \
  "$staging_key_dir/id_ed25519.pub" \
  "$staging_key_dir/known_hosts"
rmdir -- "$staging_key_dir"
```

Do not use a glob, `$HOME`, the repository root, or a broad `/private/tmp`
target. Report that the local private key was removed and is recoverable only
from the protected GitLab variable.

### Task 5: Validate and publish the completed GitLab-side change

**Files:**
- Verify: `.gitlab-ci.yml`
- Verify: `deploy/tests/gitlab-ci.sh`
- Verify: `deploy/README.md`

- [ ] **Step 1: Run fresh local verification**

Run:

```bash
bash deploy/tests/run.sh
bash -n deploy-dev-staging.sh deploy/tests/*.sh
git diff --check origin/develop...HEAD
git status --short
```

Expected: deployment suite and syntax checks exit `0`, diff check is clean,
and the working tree is empty.

- [ ] **Step 2: Validate against the authenticated GitLab instance**

Run:

```bash
glab ci lint .gitlab-ci.yml -R net7-main/ingv/pygeoapi-proxy
```

Expected: `CI/CD YAML is valid!` and exit `0`.

- [ ] **Step 3: Push `develop` and verify the remote SHA**

Run:

```bash
git push origin develop
git rev-parse HEAD
glab api "projects/:fullpath/repository/branches/develop"
```

Expected: the local and GitLab `develop` commit IDs are identical.

- [ ] **Step 4: Stop at the server checkpoint**

Provide the administrator with:

- the dedicated public key line and client-key SHA256 fingerprint;
- the exact account verification and SSH bootstrap commands from
  `deploy/README.md`;
- confirmation that all six variables are present and protected;
- confirmation that no Merge Request was created or merged and no server state
  was changed.

Wait for the administrator to verify `gitlab_deploy`, install the public key,
prepare the checkout and `.env.staging`, and complete the first supervised
server checks before creating the `develop` to `staging` Merge Request.
