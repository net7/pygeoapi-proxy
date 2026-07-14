# Admin User Force Deletion Design

## Context

The admin users page already supports user deactivation through `DELETE /admin/users/{user}`.
That action is intentionally reversible and preserves user history, jobs, results, social
accounts, passkeys, and audit context.

The application also already supports destructive job deletion through
`App\Actions\Ogc\DeleteProcessExecution`. That action deletes a local process execution only
after the remote OGC job deletion succeeds or the remote service reports `404`.

This design adds a separate destructive admin action for permanently deleting a user and all
related data.

## Goals

- Add a distinct "permanently delete user" action to `/admin/users`.
- Keep the existing deactivate and restore actions unchanged.
- Require strong confirmation by typing the user's email address.
- Show the target email in the confirmation modal with a copy-to-clipboard button.
- Delete all local and remote jobs owned by the user before deleting the user.
- Delete all local data connected to the user, including results, social accounts, passkeys,
  sessions, and locally uploaded avatar files.
- Block self-deletion from the admin users table.
- Preserve clean failure semantics when a remote job cannot be deleted.

## Non-Goals

- No bulk user deletion.
- No background deletion workflow in this iteration.
- No soft-delete or recovery state for permanently deleted users.
- No changes to normal account self-deletion in settings.
- No dependency changes.

## Decisions

### Separate Destructive Action

The new action is separate from the existing deactivation action.

`admin.users.destroy` continues to mean "deactivate user". The permanent deletion feature uses a
new backend endpoint and a separate table action. This avoids changing the meaning of existing UI,
routes, and tests.

### Conservative Job-First Deletion

Permanent user deletion is job-first and conservative:

1. Load the target user's jobs in a deterministic order.
2. Delete each job through `App\Actions\Ogc\DeleteProcessExecution`.
3. Treat remote `404` as success through the existing job deletion action.
4. Stop on any remote timeout, `5xx`, authorization error, or other non-`404` failure.
5. Delete the user only after all jobs have been deleted locally.

If deletion stops because a remote job fails, the user remains in the database. Jobs already
deleted before the failure remain deleted. Jobs not yet processed, and the failing job, remain
visible so an admin can retry.

This is intentionally not wrapped in a single database transaction because remote HTTP deletion
cannot participate in the database transaction. The design prefers explicit, retryable progress
over pretending the remote and local systems are atomic together.

### Delete Everything Local

After all jobs are deleted, the permanent deletion flow removes all local data tied to the user:

- sessions are deleted explicitly;
- the local avatar file is deleted from the public disk when `avatar_path` is set;
- the user row is deleted;
- process executions and results are removed by the job-first step before the user row is deleted;
- social accounts and passkeys are removed by existing database cascades.

Missing avatar files do not block deletion.

### Anti-Lockout

An admin cannot permanently delete their own account from the admin users table.

The frontend disables the action for the current user and explains why. The backend also blocks
self-deletion so the rule is enforced even if a request is crafted manually.

## Backend Design

Add a new action, `App\Actions\Admin\DeleteUser`, as the single place that coordinates permanent
user deletion.

The action accepts the target `User` and:

1. Iterates over the target user's `processExecutions()`.
2. Calls `DeleteProcessExecution::handle()` for each execution.
3. Deletes target sessions from the `sessions` table.
4. Deletes the uploaded avatar from `Storage::disk('public')` if `avatar_path` is filled.
5. Deletes the user.

The controller remains responsible for authorization and request validation.

Add a new controller method on `App\Http\Controllers\Admin\UserController`:

```php
public function forceDestroy(ForceDeleteUserRequest $request, User $user, DeleteUser $deleteUser): RedirectResponse
```

The method:

- confirms the authenticated user is an active admin through existing admin middleware;
- blocks self-deletion;
- validates that `email_confirmation` matches the target user's normalized email;
- calls the deletion action;
- flashes a success toast when the user is fully deleted;
- catches remote deletion failures, reports them, flashes an error toast, and redirects back.

Add a dedicated request class, `App\Http\Requests\Admin\ForceDeleteUserRequest`. It validates:

- `email_confirmation` is required;
- the submitted value matches the target user's current email exactly after the same normalization
  used by admin user management.

Add a new route under the existing admin group:

```php
Route::delete('users/{user}/force', [AdminUserController::class, 'forceDestroy'])
    ->name('users.force-destroy');
```

The route name is `admin.users.force-destroy`, and it stays separate from `admin.users.destroy`.

## Frontend Design

On `resources/js/pages/admin/users/index.tsx`, add a separate destructive table action.

The row actions become:

- view jobs;
- edit;
- deactivate or restore;
- permanently delete.

For the authenticated admin's own row, the permanent delete button is disabled or wrapped in the
existing "action unavailable" popover pattern.

The permanent deletion modal shows:

- target user's name;
- target user's email in a monospace value;
- copy-to-clipboard button beside the email;
- number of jobs that will be deleted;
- a warning that deletion removes the user, local jobs, remote jobs, results, sessions, social
  accounts, passkeys, and local avatar file;
- an input asking the admin to type the email address;
- a destructive submit button labelled "Permanently delete" or the localized equivalent.

The submit button is enabled only when the typed email equals the target email. The backend still
validates the same rule.

On success, close the modal and reload the users table. On remote deletion failure, show the error
toast from the server and refresh the table so any jobs already deleted are reflected in the job
count.

## Data Flow

Admin clicks the permanent delete action in the users table.

The React page opens a confirmation modal with user identity, email copy control, job count, and
impact warning.

Admin copies or reads the email, types it into the confirmation field, and submits.

Laravel route model binding resolves the target user. The request validates the typed email. The
controller blocks self-deletion.

`DeleteUser` deletes the user's jobs through `DeleteProcessExecution`. Each remote job with
`remote_job_id` is deleted from pygeoapi before the local execution is deleted.

When no target jobs remain, local user-owned data is deleted and the user row is removed.

## Error Handling

Incorrect or missing email confirmation returns validation errors and performs no deletion.

Self-deletion returns an error and performs no deletion.

Remote job `404` is treated as success because the remote job is already absent.

Remote job timeout, `5xx`, authorization failure, or any other non-`404` failure stops the process.
The target user remains. Previously deleted jobs remain deleted. The UI shows an error toast and
lets the admin retry later.

Missing avatar files do not block deletion.

Local authorization failures return `403` through existing admin middleware or request
authorization.

## Testing

Add or update Pest feature tests for the admin user management area:

- Admin can permanently delete a user with remote and local jobs.
- The app sends remote `DELETE` requests for each job with `remote_job_id`.
- Remote `404` does not block deletion.
- Remote non-`404` failure blocks user deletion and preserves the failing and unprocessed jobs.
- Jobs deleted before a later remote failure remain deleted.
- Admin cannot permanently delete their own account.
- `email_confirmation` is required and must match the target email.
- Normal users cannot access the permanent deletion route.
- Target sessions are removed.
- Local avatar file is removed.
- Social accounts and passkeys are removed through cascade.

Run focused tests:

```bash
php artisan test --compact tests/Feature/Admin/AdminUserManagementTest.php tests/Feature/Ogc/ProcessExecutionDeletionTest.php
```

After PHP edits during implementation, run:

```bash
vendor/bin/pint --dirty --format agent
```
