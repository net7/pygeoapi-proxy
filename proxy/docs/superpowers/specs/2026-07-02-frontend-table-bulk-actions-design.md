# Frontend Table Bulk Actions Design

## Context

The application has three data tables that need row selection and bulk actions:

- `resources/js/pages/process-executions/index.tsx` for the signed-in user's jobs.
- `resources/js/pages/admin/jobs/index.tsx` for the admin job list.
- `resources/js/pages/admin/users/index.tsx` for admin user management.

Other tables in the frontend are preview or form-support tables, such as result previews and dynamic array inputs. They are excluded from this work because they do not represent persisted record lists with bulk operations.

The shadcn documentation recommends the TanStack Table row-selection pattern: add a non-sortable, non-hideable `select` column, render a `Checkbox` in the header and each row, store `rowSelection` state in `useReactTable`, and use selected row models to drive selected counts and actions.

## Goals

- Add row checkboxes to every eligible frontend data table.
- Add a bulk action toolbar that appears when at least one row is selected.
- Support bulk delete for job tables.
- Support bulk deactivate and bulk restore for the admin users table.
- Keep force delete as a single-row-only action.
- Preserve current filtering, sorting, pagination, row navigation, and column visibility behavior.
- Use existing shadcn components and project styling conventions.

## Non-Goals

- Do not add bulk actions to preview tables, result tables, or form-builder tables.
- Do not add permanent bulk user deletion.
- Do not replace the existing table implementation or introduce a new data-grid dependency.
- Do not change server-side pagination semantics beyond the currently loaded page.

## Frontend Design

Each eligible table will add a `select` column before the first visible data column. The header checkbox selects or clears all rows on the current table page using TanStack's page-row selection APIs. Each row checkbox toggles that specific row and stops click propagation where rows are navigable, so selecting a job does not open its detail page.

The `select` column will be:

- `enableSorting: false`
- `enableHiding: false`
- Fixed-width via the existing `columnClassNames` map.
- Labeled with accessible `aria-label` strings.

Each table component will hold a `rowSelection` state object and pass it to `useReactTable` through `onRowSelectionChange` and `state.rowSelection`. The selected records will come from `table.getFilteredSelectedRowModel().rows`.

The toolbar will sit with the existing filter and column controls. It will show the selected count and a compact bulk action control:

- Job tables: destructive `Delete selected` action.
- User table: `Deactivate selected` and `Restore selected`.

Bulk actions open a confirmation dialog before submitting. The dialog will use the existing `Dialog` component rather than adding `alert-dialog`, because the project already uses `Dialog` for destructive confirmations and `alert-dialog` is not installed.

After a successful bulk action, the table clears `rowSelection` and reloads only the affected Inertia props where practical. If the request fails, selection remains so the user can retry or adjust the selection.

## Backend Design

Bulk actions will use dedicated endpoints instead of issuing many individual client requests.

Jobs:

- Add a `DELETE /jobs` route named `jobs.bulk-destroy`.
- Validate a required `ids` array of existing process execution IDs.
- Resolve the records, authorize `delete` on each one through `ProcessExecutionPolicy`, and delete them with `DeleteProcessExecution`.
- Reuse the current remote-delete behavior: a remote 404 is treated as success, while connection failures and non-404 remote errors stop the request and flash an error toast.
- Admins can delete any selected job by existing policy; normal users can delete only their own jobs.

Users:

- Add a `DELETE /admin/users` route named `admin.users.bulk-destroy` for bulk deactivation.
- Add a `PATCH /admin/users/restore` route named `admin.users.bulk-restore` for bulk restoration.
- Validate a required `ids` array of existing user IDs.
- Block operations containing the current admin's own user ID.
- Deactivation sets `deactivated_at` and invalidates sessions for each selected user.
- Restoration clears `deactivated_at` for each selected user.

All endpoints will redirect back with flash feedback showing how many records were affected. Validation and authorization failures will produce normal Laravel responses and leave data unchanged except where an external remote delete has already succeeded before a later remote failure.

## Components and Reuse

The frontend will introduce only small shared abstractions that remove duplication without hiding table-specific behavior. Reusable pieces:

- A select-column helper for TanStack tables, typed generically by row type.
- A bulk toolbar/dialog component that accepts selected count, action labels, processing state, and submit callbacks.

Table-specific action lists remain in the page files because jobs and users have different permitted operations and confirmation copy.

## Data Flow

1. User selects rows with row checkboxes or the page-level checkbox.
2. Table updates `rowSelection`.
3. Toolbar derives selected records from `getFilteredSelectedRowModel()`.
4. User chooses a bulk action.
5. Confirmation dialog opens with the selected count.
6. Dialog submits IDs through Inertia using generated Wayfinder routes.
7. Backend validates, authorizes, performs the operation, and redirects back.
8. Inertia refreshes the list and the frontend clears row selection on success.

## Error Handling

Job bulk delete can fail because remote deletion can fail. In that case, the endpoint reports the same type of error as single-job deletion and stops at the first failing remote job. Already-deleted jobs remain deleted, and the user can retry the remaining selection after refresh.

User bulk operations will fail before making changes if validation fails or the selection contains the current admin. Per-record authorization is covered by the admin middleware and explicit self-action guard.

The UI disables submit buttons while processing and uses `Spinner` inside buttons, matching existing patterns.

## Accessibility

Checkboxes will have clear `aria-label` text for selecting all visible rows and selecting individual rows. Destructive dialogs will include `DialogTitle` and `DialogDescription`. Icon buttons keep visible or screen-reader labels, following current shadcn component usage.

## Testing

Backend feature tests:

- Owners can bulk delete their own jobs.
- Users cannot bulk delete another user's jobs.
- Admins can bulk delete jobs from the admin table.
- Remote 404 is treated as success.
- Remote failure leaves the failing job available and flashes an error.
- Admins can bulk deactivate users and invalidate sessions.
- Admins can bulk restore users.
- Admins cannot include themselves in a bulk user action.

Frontend/source tests:

- Each eligible table imports and renders `Checkbox` selection.
- Each eligible table configures `rowSelection`.
- The select column is not sortable or hideable.
- Bulk toolbar/dialog labels exist in translation messages.
- Preview/form tables remain without bulk-selection behavior.

Verification commands:

- `php artisan test --compact` with targeted feature/unit files.
- `bunx tsc --noEmit` or the project type-check script.
- `vendor/bin/pint --dirty --format agent` after PHP edits.
