# Job Notes Design

## Summary

Add an optional rich-text user note to each process execution. Users can add the note while creating a job and can edit it later from the job detail page, even while the job is still submitting, running, or polling. Administrators can view and edit notes on jobs owned by other users.

The note is a single mutable field on `process_executions`, stored as Tiptap JSON. The UI renders the note on the detail page and exposes editing through a shadcn `Dialog` using the same Tiptap editor used in the create form.

## Goals

- Let users attach a note to a job at creation time.
- Let owners and admins modify the note at any point in the job lifecycle.
- Show the rendered note on the job detail page.
- Show the note's last updated date separately from the job's own `updated_at`, because polling updates the job record.
- Keep the first version scoped to the create and detail pages; job lists do not show or search notes.

## Non-Goals

- No note history, comments, or multiple notes per job.
- No note preview or note filtering on job index tables.
- No collaboration, mentions, file attachments, images, or embedded media.
- No HTML storage as the source of truth.

## Data Model

Add two nullable columns to `process_executions`:

- `note` JSON nullable: the Tiptap document.
- `note_updated_at` timestamp nullable: updated only when the note is saved.

An empty editor state is treated as no note and stored as `null`. `note_updated_at` remains `null` until the first note save. If an existing note is cleared, `note` becomes `null` and `note_updated_at` is updated, because the note was edited. The detail page then shows the empty state plus the note last-updated date.

`ProcessExecution` gets `note` in fillable attributes and casts:

- `note` as array.
- `note_updated_at` as datetime.

## Backend

### Create

`StoreProcessExecutionRequest` accepts optional `note` input. The request validates it as a Tiptap JSON document shape:

- top-level object.
- `type` equals `doc`.
- optional `content` array.
- bounded serialized size to prevent very large notes.

`CreateProcessExecution::handle()` accepts an optional note parameter separately from the OGC execution payload. The note must not be sent to the remote OGC process execution endpoint. If the note is non-empty, it is stored with `note_updated_at = now()`.

### Update

Add an authenticated route:

`PATCH /jobs/{processExecution}/note`

The update authorizes through `ProcessExecutionPolicy::update`. That policy should allow the job owner or an admin to update notes. It should not depend on job status, so running and unfinished jobs remain editable.

The update validates the same note shape as creation, stores normalized note JSON or `null`, and updates `note_updated_at`. It redirects back with a success toast.

### Show

The job detail Inertia prop includes:

- `note`
- `noteUpdatedAt`

The existing polling call on the detail page requests only `execution` and `pollingInterval`. Since the note is inside `execution`, implementation must avoid overwriting local modal edits during polling. A practical first version can keep the modal form state independent and reload normally after save.

## Frontend

### Editor

Create a reusable job note editor component based on Tiptap React. The official Tiptap docs support initializing React editors with `useEditor` and `EditorContent`, retrieving JSON with `editor.getJSON()`, and rendering Tiptap JSON with a static renderer.

The toolbar uses shadcn components and lucide icons. First-version controls:

- undo
- redo
- bold
- italic
- bullet list
- ordered list
- blockquote
- link

Use `StarterKit` plus the Tiptap link extension. The editor stores JSON, not HTML.

### Create Form

`DynamicProcessForm` extends its Inertia form data with `note`. The note editor is optional and appears in the right-side sidebar near outputs and submit. The submitted payload includes `note` for the Laravel app, while `executionPayload()` keeps only OGC `inputs` and `outputs` for the remote job.

### Detail Page

`process-executions/show.tsx` adds a note card in the right-side column above the request card.

The card shows:

- title: "Note"
- rendered note content when present
- empty state when absent
- note last updated date when `noteUpdatedAt` is present
- "Edit" button

The edit button opens a shadcn `Dialog` with the editor. Saving patches the note route and closes after the Inertia request succeeds. Cancel closes without persisting changes.

## Authorization

- Job owner can view and edit their note.
- Admin can view and edit notes for any job they can open.
- Other users cannot view another user's job detail and cannot update its note.

This aligns note visibility with the existing job detail authorization.

## Localization

Add Italian and English strings for:

- note
- edit note
- save note
- note saved
- no note
- note last updated
- link URL prompt
- remove link

## Testing

Backend feature tests:

- creating a job stores a note and sets `note_updated_at`.
- creating a job without a note leaves both note fields null.
- owner can update a note on a non-terminal job.
- admin can update another user's note.
- unrelated user cannot update another user's note.
- update clears a note when an empty editor document is submitted.

Frontend/layout tests:

- create form includes the note editor.
- job detail includes the note section.
- job detail includes the edit-note dialog trigger.
- job detail displays the note last-updated label.

Verification commands:

- `php artisan test --compact` with the affected feature/unit filters.
- `bunx tsc --noEmit` or the project's TypeScript check command.
- `vendor/bin/pint --dirty --format agent` after PHP edits.

## Risks

- Rendering HTML from stored rich text can create XSS risk. Store Tiptap JSON and render through Tiptap React/static renderer rather than trusting arbitrary HTML.
- Tiptap dependencies may require new packages. Dependencies should be added deliberately and only for the editor, StarterKit, link extension, and any static rendering utility needed.
- Polling can refresh the detail page while the modal is open. Keep editor state local to the dialog and save through an explicit patch route.
