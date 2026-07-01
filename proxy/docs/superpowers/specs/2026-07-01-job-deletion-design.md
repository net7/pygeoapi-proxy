# Job Deletion Design

## Context

The application stores OGC process executions locally in `process_executions` and shows them in two places:

- `/jobs` for the authenticated user's own jobs.
- `/admin/jobs` for administrators, with owner context and filters.

The remote pygeoapi OpenAPI document at `https://voice.pi.ingv.it/geoinquire/openapi?f=json` exposes:

- `DELETE /jobs/{jobId}` with summary `Cancel / delete job`.
- `204` for success.
- `404` when the remote job is not found.

The requested behavior is complete deletion: remove the job from the application, and when possible cancel/delete it remotely first.

## Goals

- Let a job owner delete one of their jobs.
- Let an admin delete any user's job from the admin area.
- Call remote pygeoapi deletion when the local execution has a `remote_job_id`.
- Treat remote `404` as a successful deletion because the remote job is already gone.
- Keep the local record if remote deletion fails with any non-`404` error.
- Remove associated local results through the existing `process_execution_results.process_execution_id` cascade.
- Expose the action from both job lists and the job detail page.

## Non-Goals

- No soft delete or audit-state workflow.
- No new `cancelled` or `deleted` execution status.
- No bulk deletion.
- No dependency changes.
- No changes to queue worker behavior beyond the fact that polling jobs already no-op when the local execution no longer exists.

## Backend Design

Add a dedicated action, `App\Actions\Ogc\DeleteProcessExecution`, as the single place that coordinates remote and local deletion.

The action accepts a `ProcessExecution` and:

1. If `remote_job_id` is blank, deletes the local execution.
2. If `remote_job_id` is present, calls `OgcProcessesClient::deleteJob($remoteJobId)`.
3. If the remote call succeeds with `204`, deletes the local execution.
4. If the remote call throws a `RequestException` with status `404`, deletes the local execution.
5. If the remote call throws any other exception, rethrows and leaves the local execution untouched.

Extend `OgcProcessesClient` with a `deleteJob(string $jobId): Response` method that sends `DELETE` to `/jobs/{jobId}` using the existing request configuration.

Add `ProcessExecutionController::destroy(ProcessExecution $processExecution, DeleteProcessExecution $deleteProcessExecution): RedirectResponse`.

The controller:

- Authorizes with `Gate::authorize('delete', $processExecution)`.
- Calls the action.
- Flashes a success toast when deletion completes.
- Redirects to `jobs.index`.
- Catches remote deletion failures that should block local deletion, flashes a generic error toast, and redirects back without deleting the local execution.

Use one canonical route:

- `DELETE /jobs/{processExecution}` named `jobs.destroy`.

The admin page should call this same route. A separate `admin.jobs.destroy` route is not needed because authorization belongs in the policy.

Update `ProcessExecutionPolicy::delete()`:

- Allow admins.
- Allow the owner of the execution.
- Deny everyone else.

## Frontend Design

Expose deletion in three places:

- `/jobs`: add a destructive action in each row next to the details action.
- `/admin/jobs`: add the same destructive action in each row, using the canonical `jobs.destroy` route.
- `/jobs/{id}`: add a destructive action in the header or job summary area.

Each action opens a confirmation dialog before sending the request.

The dialog shows enough context to avoid accidental deletion:

- Process title or process id.
- Local job id.
- Remote job id when available.
- A warning that the job will be removed from the platform and the application will attempt to delete it from the remote OGC service.

On confirm:

- Send an Inertia `DELETE` request to `jobs.destroy`.
- Preserve scroll for list pages.
- Stop event propagation in table rows so clicking delete does not navigate to the detail page.

After success:

- From `/jobs` and `/admin/jobs`, refresh the list data and close the dialog.
- From `/jobs/{id}`, redirect to `/jobs`.
- Show a success toast.

After a remote non-`404` failure:

- Keep the record visible.
- Show a generic failure message.

## Data Flow

User or admin clicks delete, confirms, and submits an Inertia `DELETE` request.

Laravel route model binding resolves the `ProcessExecution`.

`ProcessExecutionPolicy::delete()` checks whether the current user is an admin or the job owner.

`DeleteProcessExecution` calls pygeoapi when a remote id exists, then deletes the local execution only after remote success or remote `404`.

Deleting the local execution removes related results through the existing database cascade. Pending `PollProcessExecutionJob` instances are harmless because they already return early when `ProcessExecution::find($id)` returns `null`.

## Error Handling

Remote `404` is treated as success because the remote job no longer exists.

Remote timeout, `5xx`, authorization failure, or any other non-`404` failure blocks local deletion. This avoids hiding remote state that the application failed to delete.

Local authorization failures return `403`.

Jobs without `remote_job_id` are deleted locally only. This covers local records that were created but never successfully submitted.

## Testing

Add or update Pest feature tests:

- Owners can delete their own job with `remote_job_id`; the app sends `DELETE` to the remote OGC URL and removes the local execution.
- Remote `404` still removes the local execution.
- Remote non-`404` failure leaves the local execution in place.
- Users cannot delete another user's job.
- Admins can delete jobs owned by another user.
- Jobs without `remote_job_id` delete locally without a remote request.
- Associated `process_execution_results` are removed by cascade.

Run focused backend tests for the changed job features. Run frontend type or existing frontend tests after TypeScript changes. Run `vendor/bin/pint --dirty --format agent` after PHP edits during implementation.
