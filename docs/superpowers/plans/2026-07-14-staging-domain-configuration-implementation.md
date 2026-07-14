# Staging Domain Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the staging application and Reverb endpoint to use `proxygeoapi.netseven.work` without changing secrets, ports, or TLS ownership.

**Architecture:** Keep the existing Docker Compose topology and external TLS termination. Change only the two public-domain variables in the versioned staging template and in the ignored local staging environment, then validate the merged Compose configuration without printing secret values.

**Tech Stack:** Docker Compose, GNU Make, dotenv files, POSIX shell assertions

---

## File map

- Modify `.env.staging.example`: versioned defaults used when creating a new staging environment.
- Modify `.env.staging`: active local staging configuration; this file remains ignored by Git and all sensitive values remain untouched.
- No application source, Compose topology, port, DNS, certificate, or reverse-proxy files change.

### Task 1: Update the versioned staging template

**Files:**

- Modify: `.env.staging.example:11`
- Modify: `.env.staging.example:39`

- [ ] **Step 1: Run assertions that demonstrate the template still has the old domain**

Run each command separately:

```bash
test "$(sed -n 's/^APP_URL=//p' .env.staging.example)" = "https://proxygeoapi.netseven.work"
test "$(sed -n 's/^REVERB_HOST=//p' .env.staging.example)" = "proxygeoapi.netseven.work"
```

Expected: both commands exit with status `1`, because the template still uses
`staging.example.com`.

- [ ] **Step 2: Replace only the two public-domain values**

Apply this exact patch:

```diff
-APP_URL=https://staging.example.com
+APP_URL=https://proxygeoapi.netseven.work
```

```diff
-REVERB_HOST=staging.example.com
+REVERB_HOST=proxygeoapi.netseven.work
```

Do not modify `APP_PORT`, `REVERB_HOST_PORT`, `REVERB_PORT`,
`REVERB_SCHEME`, `SSL_MODE`, or any credential placeholder.

- [ ] **Step 3: Re-run the template assertions**

```bash
test "$(sed -n 's/^APP_URL=//p' .env.staging.example)" = "https://proxygeoapi.netseven.work"
test "$(sed -n 's/^REVERB_HOST=//p' .env.staging.example)" = "proxygeoapi.netseven.work"
```

Expected: both commands exit with status `0` and print nothing.

- [ ] **Step 4: Verify the old placeholder is absent and the fixed values are unique**

```bash
test "$(rg -c '^APP_URL=https://proxygeoapi\.netseven\.work$' .env.staging.example)" = "1"
test "$(rg -c '^REVERB_HOST=proxygeoapi\.netseven\.work$' .env.staging.example)" = "1"
! rg -n 'staging\.example\.com' .env.staging.example
```

Expected: all commands exit with status `0`; the final command prints nothing.

- [ ] **Step 5: Commit the versioned template change**

```bash
git add .env.staging.example
git commit -m "Configure staging public domain"
```

Expected: one commit containing only the two template replacements.

### Task 2: Update the active ignored staging environment

**Files:**

- Modify: `.env.staging:11`
- Modify: `.env.staging:39`

- [ ] **Step 1: Confirm the active file is ignored and fingerprint every unaffected line**

```bash
git check-ignore -q .env.staging
awk '!/^(APP_URL|REVERB_HOST)=/' .env.staging | shasum -a 256
```

Expected: `git check-ignore` exits with status `0`. The second command prints a
64-character SHA-256 digest; retain that digest in the execution notes for the
comparison in Step 4. It represents every line except the two authorized domain
settings and does not reveal any secret.

- [ ] **Step 2: Run assertions that demonstrate the active file still has the old domain**

```bash
test "$(sed -n 's/^APP_URL=//p' .env.staging)" = "https://proxygeoapi.netseven.work"
test "$(sed -n 's/^REVERB_HOST=//p' .env.staging)" = "proxygeoapi.netseven.work"
```

Expected: both commands exit with status `1`.

- [ ] **Step 3: Replace only the two active public-domain values**

Apply this exact patch:

```diff
-APP_URL=https://staging.example.com
+APP_URL=https://proxygeoapi.netseven.work
```

```diff
-REVERB_HOST=staging.example.com
+REVERB_HOST=proxygeoapi.netseven.work
```

Do not inspect, copy, regenerate, or modify any other value in `.env.staging`.

- [ ] **Step 4: Verify the new values and prove every other line is unchanged**

```bash
test "$(sed -n 's/^APP_URL=//p' .env.staging)" = "https://proxygeoapi.netseven.work"
test "$(sed -n 's/^REVERB_HOST=//p' .env.staging)" = "proxygeoapi.netseven.work"
awk '!/^(APP_URL|REVERB_HOST)=/' .env.staging | shasum -a 256
```

Expected: the first two commands exit with status `0`. The SHA-256 digest is
identical to the digest recorded in Step 1, proving all unaffected lines,
including credentials, remained byte-for-byte unchanged.

- [ ] **Step 5: Confirm the local environment remains outside version control**

```bash
git check-ignore -q .env.staging
git diff -- .env.staging
```

Expected: the first command exits with status `0`; the second prints nothing.
Do not add `.env.staging` to Git.

### Task 3: Validate the merged staging configuration

**Files:**

- Verify: `.env.staging.example`
- Verify: `.env.staging`
- Verify: `compose.yaml`
- Verify: `compose.staging.yaml`

- [ ] **Step 1: Render Docker Compose while suppressing interpolated secrets**

```bash
make staging config >/dev/null
```

Expected: exit status `0`. Standard output is discarded because the rendered
configuration includes credentials; any parsing or interpolation error remains
visible on standard error.

- [ ] **Step 2: Verify the exact public endpoints and unchanged transport settings**

```bash
rg -n '^(APP_PORT|REVERB_HOST_PORT|APP_URL|REVERB_HOST|REVERB_PORT|REVERB_SCHEME|SSL_MODE)=' .env.staging
```

Expected output:

```text
4:APP_PORT=8080
5:REVERB_HOST_PORT=8081
11:APP_URL=https://proxygeoapi.netseven.work
39:REVERB_HOST=proxygeoapi.netseven.work
40:REVERB_PORT=8081
41:REVERB_SCHEME=https
58:SSL_MODE=off
```

- [ ] **Step 3: Run repository hygiene checks**

```bash
git diff --check
git status --short
```

Expected: `git diff --check` prints nothing. `git status --short` prints nothing
after the Task 1 commit because `.env.staging` remains ignored.

- [ ] **Step 4: Record the operational boundary in the handoff**

Report that the repository now targets:

```text
Application: https://proxygeoapi.netseven.work
Reverb:     wss://proxygeoapi.netseven.work:8081
```

Also report that DNS, the certificate, HTTPS forwarding to host port `8080`,
and WSS forwarding to host port `8081` remain responsibilities of the external
staging infrastructure and were not changed by this plan.
