# Staging deployment over a non-standard SSH port

## Context

The staging deployment target is reachable at `91.107.228.84` on SSH port
`1024`, not on the default port `22`. The server administrator supplied the
authoritative Ed25519 host-key fingerprint:

```text
SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI
```

The deployment checkout is
`/docker-data/configuration/pygeoapi-proxy`. The server account is the existing
`gitlab_deploy` identity, already assigned to the `docker` and `www-data`
groups.

This design extends the approved staging CI/CD design without changing its
branch workflow, Laravel deployment sequence, or environment scope.

## Decision

Use a dedicated protected GitLab variable named `DEPLOY_PORT`, scoped to the
`staging` environment, with value `1024`.

The deploy job will:

1. require `DEPLOY_PORT` to contain only decimal digits;
2. reject values outside the range `1` through `65535`;
3. invoke OpenSSH as `ssh -p "$DEPLOY_PORT"`;
4. continue to require strict host-key verification through the
   `DEPLOY_KNOWN_HOSTS` file variable.

The port will not be hardcoded in `.gitlab-ci.yml` and the job will not create
an implicit `~/.ssh/config`. Keeping the value explicit makes configuration
drift visible in GitLab and allows a future port change without a code change.

## GitLab variables

The complete staging variable set becomes:

| Variable | Type | Protection | Value |
| --- | --- | --- | --- |
| `DEPLOY_SSH_KEY` | File | Protected | Dedicated private Ed25519 key |
| `DEPLOY_KNOWN_HOSTS` | File | Protected | Verified host-key entry for `[91.107.228.84]:1024` |
| `DEPLOY_HOST` | Variable | Protected | `91.107.228.84` |
| `DEPLOY_PORT` | Variable | Protected | `1024` |
| `DEPLOY_USER` | Variable | Protected | `gitlab_deploy` |
| `DEPLOY_PATH` | Variable | Protected | `/docker-data/configuration/pygeoapi-proxy` |

All six variables use environment scope `staging`. No value is copied from the
unrelated 3P project.

## Host-key verification

The public host key will be collected with:

```bash
ssh-keyscan -H -p 1024 -t ed25519 91.107.228.84
```

The scanned key is accepted only if `ssh-keygen -lf` reports the authoritative
fingerprint supplied by the administrator. A mismatch stops configuration;
host-key checking is never disabled.

Because the port is non-standard, the generated `known_hosts` entry represents
the host as `[91.107.228.84]:1024` before hashing. GitLab stores the verified
entry as a protected File variable.

## Dedicated client key

Generate a new Ed25519 key pair in a mode-`0700` temporary directory with:

```bash
ssh-keygen -q -t ed25519 -a 100 -N '' \
  -C 'gitlab-pygeoapi-proxy-staging' \
  -f ./pygeoapi-proxy-staging
```

The private key is uploaded directly to `DEPLOY_SSH_KEY` and is never printed,
committed, or copied to the project workspace. The public key and its SHA256
fingerprint are provided to the administrator. Local temporary key material is
removed after GitLab variable creation has been verified.

## Server account bootstrap

Before the first merge to `staging`, an administrator will run the documented
checks on the target server.

Preserve the existing `gitlab_deploy` UID, home, shell, groups, and authorized
keys. Do not grant passwordless sudo merely for the deployment.

The administrator will then:

1. create `~gitlab_deploy/.ssh` with owner `gitlab_deploy`, mode `0700`;
2. add the generated public key to `authorized_keys` only if it is not already
   present;
3. set `authorized_keys` owner to `gitlab_deploy` and mode `0600`;
4. from an administrative workstation, verify that the dedicated key connects
   as `gitlab_deploy` on port `1024` using the verified `known_hosts` file;
5. verify `sudo -u gitlab_deploy docker info` and `docker compose version`;
6. prepare the checkout and existing `.env.staging` with ownership suitable for
   `gitlab_deploy`.

These server operations remain manual and supervised. No pipeline is merged to
`staging` until the checks pass.

## Error handling

- A missing, non-numeric, zero, negative, or greater-than-`65535`
  `DEPLOY_PORT` fails before any network connection.
- A host-key fingerprint mismatch prevents creation of
  `DEPLOY_KNOWN_HOSTS`.
- An unavailable `gitlab_deploy` account or rejected client key blocks the
  first deployment and is diagnosed with the runbook; it does not weaken SSH
  verification.
- GitLab variable updates are applied idempotently by key and environment
  scope. Existing unrelated variables are not changed.

## Tests and verification

Implementation follows a red-green cycle in `deploy/tests/gitlab-ci.sh`:

1. add contracts for `DEPLOY_PORT`, numeric/range validation, and
   `ssh -p "$DEPLOY_PORT"`;
2. run the focused test and observe failure because support is absent;
3. implement the smallest `.gitlab-ci.yml` change;
4. rerun the focused and full deployment test suites;
5. run Bash syntax checks, ShellCheck, Git diff checks, and GitLab CI Lint;
6. verify through the GitLab API that all six variables exist with type,
   protection, and scope metadata as designed, without displaying their values.

The existing PHP, frontend, and Docker behavior is unchanged by this
extension.

## Rollout boundary

This change prepares GitLab and the runbook. It does not create or modify the
server account, write `authorized_keys`, create the checkout, or merge
`develop` into `staging`. Those actions remain the next supervised operational
phase.
