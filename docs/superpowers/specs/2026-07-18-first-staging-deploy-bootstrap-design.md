# First staging deployment bootstrap design

## Context

The staging server checkout currently tracks `origin/staging`, where
`deploy-dev-staging.sh` is absent. The approved CI/CD implementation is present on
`develop`; after the first `develop` to `staging` merge, the deploy job will
connect over SSH and invoke:

```bash
cd "$DEPLOY_PATH" && ./deploy-dev-staging.sh staging "$CI_COMMIT_SHA"
```

This creates a one-time bootstrap dependency: the job needs `deploy-dev-staging.sh` before
the merge commit has been checked out on the server. The first staging merge
must deploy successfully on its first pipeline attempt; an intentionally
failed deploy followed by a manual retry is not acceptable.

The server prerequisites are already established:

- deployment account `gitlab_deploy` can use Docker;
- checkout root is `/docker-data/configuration/pygeoapi-proxy`;
- checkout and `.env.staging` are owned by `gitlab_deploy`;
- `.env.staging` is ignored by Git and has mode `0600`;
- `origin` uses the dedicated read-only SSH deploy key;
- the GitLab host key is pinned in the account's `known_hosts`;
- the GitLab Runner client key is authorized without replacing existing keys.

## Decision

Before merging the first Merge Request from `develop` to `staging`, install a
one-time, untracked bootstrap copy of `deploy-dev-staging.sh` in the server checkout. The
file must be extracted directly from the exact source commit of the approved
Merge Request through the authenticated Git remote.

Do not paste the script, copy it from a workstation, switch the server checkout
to `develop`, or add a permanent launcher outside the repository.

The bootstrap is self-consuming. Git documents that `checkout --force` may
replace an untracked file that is in the way. The bootstrap script fetches the
merged staging commit, validates that the requested SHA is reachable from
`origin/staging`, runs `git checkout -f --detach`, and then re-executes the
tracked `deploy-dev-staging.sh` from the target commit.

## Pre-merge flow

1. Create the `develop` to `staging` Merge Request without merging it.
2. Wait for all Merge Request quality jobs to pass.
3. Record the exact MR source SHA and verify it still equals the remote
   `develop` head.
4. On the server, fetch the authenticated remote as `gitlab_deploy`.
5. Confirm that tracked files are clean, `.env.staging` is ignored, and
   `deploy-dev-staging.sh` is absent from the current `staging` commit.
6. Extract `<source-sha>:deploy-dev-staging.sh` to a temporary file inside the checkout,
   verify its Git blob hash and shell syntax, then atomically install it as
   executable `deploy-dev-staging.sh` owned by `gitlab_deploy`.
7. Confirm that the only non-ignored working-tree change is
   `?? deploy-dev-staging.sh` and that no tracked file changed.
8. Re-read the MR source SHA immediately before merge. If it changed, stop,
   verify that `deploy-dev-staging.sh` is still untracked, remove only that exact bootstrap
   file, and repeat from the new SHA.
9. Merge only after all checks still match.

No application container, database, environment file, local branch, or
working-tree HEAD is changed during this preparation. The authenticated fetch
may update remote-tracking references.

## First automatic deployment

The push pipeline for the new `staging` merge commit runs the existing quality
jobs before `deploy:staging`. When the deploy job connects:

1. the untracked bootstrap script is already executable;
2. it acquires the deployment lock and fetches the remote;
3. it verifies the requested 40-character commit and its ancestry from
   `origin/staging`;
4. `git checkout -f --detach` replaces the bootstrap with the tracked script
   from the merge commit;
5. the script re-executes itself from the checked-out commit;
6. Compose validation, image builds, service updates, Laravel migrations,
   cache optimization, status checks, and the HTTP health check run normally.

After checkout, no bootstrap artifact remains: `deploy-dev-staging.sh` is an ordinary
tracked file at the deployed SHA.

## Safety and error handling

- All source material comes from the read-only authenticated Git remote.
- The bootstrap commit is pinned to the MR source SHA; branch names alone are
  not accepted as proof of identity.
- A blob hash mismatch, shell syntax failure, dirty tracked file, unexpected
  pre-existing `deploy-dev-staging.sh`, or changed MR source SHA stops the process before
  merge.
- `.env.staging` is never read into logs, copied, regenerated, or removed.
- The bootstrap does not run `git checkout`, `git reset`, a deployment, or any
  Docker mutation before the MR merge.
- If preparation is cancelled before merge, recovery removes only the exact
  untracked `deploy-dev-staging.sh` after verifying that Git does not track it.
- If the pipeline fails before checkout, the bootstrap remains available for a
  safe retry. If it fails after checkout, the tracked script is already
  installed and the job can be retried without bootstrapping again.
- GitLab `resource_group: staging` and the server-side `flock` continue to
  serialize automatic and manual deployments.

## Verification and acceptance criteria

Before merge, evidence must show:

- the MR pipeline succeeded;
- the recorded source SHA matches both the MR and remote `develop` head;
- the bootstrap blob hash matches `<source-sha>:deploy-dev-staging.sh`;
- `bash -n deploy-dev-staging.sh` succeeds and the file is executable;
- tracked status is clean and the only visible untracked file is `deploy-dev-staging.sh`;
- `.env.staging` remains ignored, mode `0600`, and owned by
  `gitlab_deploy`.

After merge, evidence must show:

- the first push pipeline on `staging` and `deploy:staging` job succeeded;
- the server HEAD equals the pipeline's merge commit SHA;
- `deploy-dev-staging.sh` is tracked and the tracked working tree is clean;
- Laravel and Reverb are healthy and all other services are healthy or
  running;
- `http://127.0.0.1:7070/up` and
  `https://proxygeoapi.netseven.work/up` succeed;
- the deployed URL remains `https://proxygeoapi.netseven.work`.

## Alternatives not selected

### Permanent server launcher

A root-managed launcher under `/usr/local` would solve future bootstrap cases,
but it creates a second deployment artifact outside version control and a new
server maintenance responsibility.

### Runner-side script transfer

Copying or streaming `deploy-dev-staging.sh` from the GitLab Runner would avoid an
untracked server file, but it would make the runner more than a thin SSH
trigger and duplicate code-delivery responsibilities already handled by Git.

### Failed first deploy followed by retry

Allowing the first deploy job to fail would be simpler operationally, but it
does not satisfy the requirement that the initial staging merge deploy on its
first pipeline attempt.

## Out of scope

- preparation for additional deployment environments;
- changes to the established deployment sequence;
- a permanent bootstrap service or server-side GitLab Runner;
- direct pushes to `staging`;
- automatic rollback of database migrations.
