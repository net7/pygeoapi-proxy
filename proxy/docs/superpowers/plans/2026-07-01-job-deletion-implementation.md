# Job Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete job deletion for job owners and admins, deleting the remote pygeoapi job when possible and then removing the local execution and results.

**Architecture:** Use one backend action, `DeleteProcessExecution`, to coordinate remote and local deletion. Use one canonical `jobs.destroy` route guarded by `ProcessExecutionPolicy::delete()`, with `redirect=back` for list pages and default redirect to `/jobs` for detail pages. Use one reusable React delete button/dialog component in user, admin, and detail job screens.

**Tech Stack:** Laravel 13, Pest 4, Laravel HTTP Client fakes, Inertia Laravel v3, Inertia React v3, Laravel Wayfinder, React 19, Tailwind CSS v4, shadcn/Radix dialog primitives.

---

## File Structure

- Create `tests/Feature/Ogc/ProcessExecutionDeletionTest.php` for all deletion authorization, remote-delete, local-delete, and cascade behavior.
- Create `app/Actions/Ogc/DeleteProcessExecution.php` to isolate remote/local deletion.
- Modify `app/Services/Ogc/OgcProcessesClient.php` with `deleteJob()`.
- Modify `app/Policies/ProcessExecutionPolicy.php` to allow owners and admins to delete.
- Modify `app/Http/Controllers/Ogc/ProcessExecutionController.php` with `destroy()`, success/error flash helpers, and redirect behavior.
- Modify `routes/web.php` with `DELETE /jobs/{processExecution}`.
- Regenerate Wayfinder output in `resources/js/routes/jobs/index.ts`.
- Create `resources/js/components/ogc/delete-job-dialog.tsx` as the shared UI action.
- Modify `resources/js/pages/process-executions/index.tsx` to render the shared delete action in each row.
- Modify `resources/js/pages/admin/jobs/index.tsx` to render the shared delete action in each row.
- Modify `resources/js/pages/process-executions/show.tsx` to render the shared delete action on the detail page.
- Modify `resources/js/lib/i18n/messages.ts` with Italian and English copy.

---

### Task 1: Backend Deletion Tests

**Files:**
- Create: `tests/Feature/Ogc/ProcessExecutionDeletionTest.php`

- [ ] **Step 1: Create the failing feature test**

Create `tests/Feature/Ogc/ProcessExecutionDeletionTest.php` with this complete content:

```php
<?php

use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config([
        'services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/',
    ]);
});

test('owners can delete their remote job and local results', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-123' => Http::response(null, 204),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-123',
    ]);
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
    $this->assertDatabaseMissing('process_execution_results', [
        'id' => $result->id,
    ]);

    Http::assertSent(fn (Request $request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/jobs/job-123');
});

test('remote missing jobs are treated as deleted', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/missing-job' => Http::response([
            'description' => 'Job not found.',
        ], 404),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'missing-job',
    ]);

    $this->actingAs($user)
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
});

test('remote deletion failures keep the local job', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/job-500' => Http::response([
            'description' => 'Remote service unavailable.',
        ], 500),
    ]);

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => 'job-500',
    ]);

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->delete(route('jobs.destroy', $execution))
        ->assertRedirect(route('jobs.show', $execution));

    $this->assertDatabaseHas('process_executions', [
        'id' => $execution->id,
        'remote_job_id' => 'job-500',
    ]);
});

test('users cannot delete another users job', function () {
    Http::fake();

    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'remote_job_id' => 'owned-job',
    ]);

    $this->actingAs($otherUser)
        ->delete(route('jobs.destroy', $execution))
        ->assertForbidden();

    $this->assertDatabaseHas('process_executions', [
        'id' => $execution->id,
    ]);

    Http::assertNothingSent();
});

test('admins can delete another users job from the admin list', function () {
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/admin-job' => Http::response(null, 204),
    ]);

    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'remote_job_id' => 'admin-job',
    ]);

    $this->actingAs($admin)
        ->from(route('admin.jobs.index'))
        ->delete(route('jobs.destroy', [
            'processExecution' => $execution,
            'redirect' => 'back',
        ]))
        ->assertRedirect(route('admin.jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);
});

test('local only jobs delete without a remote request', function () {
    Http::fake();

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'remote_job_id' => null,
    ]);

    $this->actingAs($user)
        ->from(route('jobs.index'))
        ->delete(route('jobs.destroy', [
            'processExecution' => $execution,
            'redirect' => 'back',
        ]))
        ->assertRedirect(route('jobs.index'));

    $this->assertDatabaseMissing('process_executions', [
        'id' => $execution->id,
    ]);

    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionDeletionTest.php
```

Expected: FAIL with `Route [jobs.destroy] not defined.`

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add tests/Feature/Ogc/ProcessExecutionDeletionTest.php
git commit -m "test: cover process execution deletion"
```

---

### Task 2: Backend Deletion Implementation

**Files:**
- Create: `app/Actions/Ogc/DeleteProcessExecution.php`
- Modify: `app/Services/Ogc/OgcProcessesClient.php`
- Modify: `app/Policies/ProcessExecutionPolicy.php`
- Modify: `app/Http/Controllers/Ogc/ProcessExecutionController.php`
- Modify: `routes/web.php`
- Generated: `resources/js/routes/jobs/index.ts`

- [ ] **Step 1: Create the action class with Artisan**

Run:

```bash
php artisan make:class Actions/Ogc/DeleteProcessExecution --no-interaction
```

Expected: `app/Actions/Ogc/DeleteProcessExecution.php` is created.

- [ ] **Step 2: Replace the action class implementation**

Replace `app/Actions/Ogc/DeleteProcessExecution.php` with:

```php
<?php

namespace App\Actions\Ogc;

use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use Illuminate\Http\Client\RequestException;

class DeleteProcessExecution
{
    public function __construct(private OgcProcessesClient $client) {}

    public function handle(ProcessExecution $execution): void
    {
        if (filled($execution->remote_job_id)) {
            try {
                $this->client->deleteJob($execution->remote_job_id);
            } catch (RequestException $exception) {
                if ($exception->response->status() !== 404) {
                    throw $exception;
                }
            }
        }

        $execution->delete();
    }
}
```

- [ ] **Step 3: Add remote delete support to the OGC client**

In `app/Services/Ogc/OgcProcessesClient.php`, add this method after `job(string $jobId): array`:

```php
    public function deleteJob(string $jobId): Response
    {
        return $this->request()
            ->delete($this->path("/jobs/{$jobId}"))
            ->throw();
    }
```

- [ ] **Step 4: Update deletion authorization**

In `app/Policies/ProcessExecutionPolicy.php`, replace the `delete()` method with:

```php
    public function delete(User $user, ProcessExecution $processExecution): bool
    {
        return $user->isAdmin() || $processExecution->user()->is($user);
    }
```

- [ ] **Step 5: Add controller imports**

In `app/Http/Controllers/Ogc/ProcessExecutionController.php`, add these imports:

```php
use App\Actions\Ogc\DeleteProcessExecution;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
```

- [ ] **Step 6: Add the controller destroy method and redirect helper**

In `app/Http/Controllers/Ogc/ProcessExecutionController.php`, add this method after `show()` and before `pollingInterval()`:

```php
    public function destroy(
        Request $request,
        ProcessExecution $processExecution,
        DeleteProcessExecution $deleteProcessExecution,
    ): RedirectResponse {
        Gate::authorize('delete', $processExecution);

        $processLabel = $processExecution->process_title ?? $processExecution->process_id;
        $localJobId = $processExecution->id;

        try {
            $deleteProcessExecution->handle($processExecution);
        } catch (ConnectionException|RequestException $exception) {
            report($exception);

            Inertia::flash('toast', [
                'type' => 'error',
                'title' => __('Job could not be deleted'),
                'message' => __('The remote service did not confirm deletion.'),
                'description' => __('The job is still available. Please try again later.'),
                'icon' => false,
            ]);

            return back();
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Job deleted'),
            'message' => __('The job has been deleted.'),
            'description' => __('The local job and its saved results were removed.'),
            'icon' => false,
            'details' => [
                [
                    'label' => __('Process'),
                    'value' => $processLabel,
                ],
                [
                    'label' => __('Local job'),
                    'value' => "#{$localJobId}",
                ],
            ],
        ]);

        if ($request->string('redirect')->toString() === 'back') {
            return back();
        }

        return to_route('jobs.index');
    }
```

- [ ] **Step 7: Add the canonical delete route**

In `routes/web.php`, add the delete route after `jobs.show` and before `jobs.results.download`:

```php
    Route::delete('jobs/{processExecution}', [ProcessExecutionController::class, 'destroy'])
        ->name('jobs.destroy');
```

- [ ] **Step 8: Regenerate Wayfinder routes**

Run:

```bash
php artisan wayfinder:generate --no-interaction
```

Expected: `resources/js/routes/jobs/index.ts` includes an exported `destroy` route for `DELETE /jobs/{processExecution}`.

- [ ] **Step 9: Run the deletion tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionDeletionTest.php
```

Expected: PASS.

- [ ] **Step 10: Format PHP changes**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: Pint reports changed files as formatted or no changes needed.

- [ ] **Step 11: Commit backend implementation**

Run:

```bash
git add app/Actions/Ogc/DeleteProcessExecution.php app/Services/Ogc/OgcProcessesClient.php app/Policies/ProcessExecutionPolicy.php app/Http/Controllers/Ogc/ProcessExecutionController.php routes/web.php resources/js/routes/jobs/index.ts
git commit -m "feat: delete process executions"
```

---

### Task 3: Shared Delete Job UI Component And Copy

**Files:**
- Create: `resources/js/components/ogc/delete-job-dialog.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`

- [ ] **Step 1: Add localized copy**

In `resources/js/lib/i18n/messages.ts`, add these keys inside the Italian `jobs` object:

```ts
        delete: 'Elimina',
        deleteConfirm: 'Elimina lavoro',
        deleteDescription:
            'Il lavoro verrà rimosso dalla piattaforma. Se esiste un ID remoto, proveremo a cancellarlo anche dal servizio OGC.',
        deleteRemoteNote:
            'Se il lavoro remoto non esiste più, la cancellazione locale continuerà.',
        deleteTitle: 'Eliminare questo lavoro?',
        localJobId: 'ID locale',
        remoteJobId: 'ID remoto',
```

Add the matching keys inside the English `jobs` object:

```ts
        delete: 'Delete',
        deleteConfirm: 'Delete job',
        deleteDescription:
            'The job will be removed from the platform. If a remote ID exists, we will try to delete it from the OGC service as well.',
        deleteRemoteNote:
            'If the remote job no longer exists, local deletion will continue.',
        deleteTitle: 'Delete this job?',
        localJobId: 'Local ID',
        remoteJobId: 'Remote ID',
```

- [ ] **Step 2: Create the shared delete component**

Create `resources/js/components/ogc/delete-job-dialog.tsx` with:

```tsx
import { router } from '@inertiajs/react';
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { destroy } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type DeleteJobButtonProps = {
    execution: ProcessExecutionListItem;
    redirectBack?: boolean;
    className?: string;
};

export function DeleteJobButton({
    execution,
    redirectBack = false,
    className,
}: DeleteJobButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const processLabel = execution.processTitle ?? execution.processId;
    const action = destroy(
        execution.id,
        redirectBack ? { query: { redirect: 'back' } } : undefined,
    ).url;

    function submit(): void {
        setProcessing(true);

        router.delete(action, {
            preserveScroll: redirectBack,
            onSuccess: () => setOpen(false),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <>
            <Button
                type="button"
                variant="destructive"
                size="sm"
                className={className}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                <Trash2Icon data-icon="inline-start" />
                {t('jobs.delete')}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="overflow-hidden p-0 sm:max-w-md"
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader className="px-6 pt-6 pr-12 text-left">
                        <DialogTitle>{t('jobs.deleteTitle')}</DialogTitle>
                        <DialogDescription className="space-y-0.5 break-words">
                            <span className="block font-semibold text-foreground">
                                {processLabel}
                            </span>
                            <span className="block font-mono text-xs text-muted-foreground italic">
                                {execution.processId}
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100">
                        <div className="flex items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200">
                                <AlertTriangleIcon
                                    data-icon="dialog-status"
                                    className="size-5"
                                />
                            </span>
                            <div className="min-w-0 space-y-2">
                                <p className="text-sm">
                                    {t('jobs.deleteDescription')}
                                </p>
                                <dl className="grid gap-1 rounded-md border border-current/15 bg-white/55 px-3 py-2 text-sm dark:bg-black/10">
                                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                                        <dt className="text-muted-foreground">
                                            {t('jobs.localJobId')}
                                        </dt>
                                        <dd className="font-mono font-semibold break-all">
                                            #{execution.id}
                                        </dd>
                                    </div>
                                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                                        <dt className="text-muted-foreground">
                                            {t('jobs.remoteJobId')}
                                        </dt>
                                        <dd
                                            className={cn(
                                                'font-mono font-semibold break-all',
                                                !execution.remoteJobId &&
                                                    'font-sans text-muted-foreground',
                                            )}
                                        >
                                            {execution.remoteJobId ??
                                                t('common.notAvailable')}
                                        </dd>
                                    </div>
                                </dl>
                                <p className="text-xs opacity-80">
                                    {t('jobs.deleteRemoteNote')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing}
                            >
                                {t('common.cancel')}
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={submit}
                            disabled={processing}
                        >
                            {processing ? (
                                <Spinner data-icon="inline-start" />
                            ) : (
                                <Trash2Icon data-icon="inline-start" />
                            )}
                            {t('jobs.deleteConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
```

- [ ] **Step 3: Run frontend i18n and type checks**

Run:

```bash
bun test tests/Frontend/i18n.test.ts
bun run types:check
```

Expected: both commands PASS.

- [ ] **Step 4: Commit shared UI component and copy**

Run:

```bash
git add resources/js/components/ogc/delete-job-dialog.tsx resources/js/lib/i18n/messages.ts
git commit -m "feat: add job delete dialog"
```

---

### Task 4: Wire Delete Action Into Job Lists

**Files:**
- Modify: `resources/js/pages/process-executions/index.tsx`
- Modify: `resources/js/pages/admin/jobs/index.tsx`

- [ ] **Step 1: Import the shared component in the user job list**

In `resources/js/pages/process-executions/index.tsx`, add this import near the other OGC component imports:

```tsx
import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
```

- [ ] **Step 2: Widen the actions column in the user job list**

In `resources/js/pages/process-executions/index.tsx`, change the `actions` entry in `columnClassNames` to:

```tsx
    actions: 'w-52 text-right',
```

- [ ] **Step 3: Replace the user list row actions**

In `resources/js/pages/process-executions/index.tsx`, replace `JobRowActions` with:

```tsx
function JobRowActions({ execution }: { execution: ProcessExecutionListItem }) {
    const { t } = useTranslation();

    return (
        <div className="flex justify-end gap-2">
            <Button asChild variant="default" size="sm">
                <Link
                    href={show(execution.id)}
                    onClick={(event) => event.stopPropagation()}
                >
                    <ListChecksIcon data-icon="inline-start" />
                    {t('jobs.details')}
                </Link>
            </Button>

            <DeleteJobButton execution={execution} redirectBack />
        </div>
    );
}
```

- [ ] **Step 4: Import the shared component in the admin job list**

In `resources/js/pages/admin/jobs/index.tsx`, add this import near the other OGC component imports:

```tsx
import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
```

- [ ] **Step 5: Widen the actions column in the admin job list**

In `resources/js/pages/admin/jobs/index.tsx`, change the `actions` entry in `columnClassNames` to:

```tsx
    actions: 'w-52 text-right',
```

- [ ] **Step 6: Replace the admin list row actions**

In `resources/js/pages/admin/jobs/index.tsx`, replace `JobRowActions` with:

```tsx
function JobRowActions({ execution }: { execution: AdminJob }) {
    const { t } = useTranslation();

    return (
        <div className="flex justify-end gap-2">
            <Button asChild variant="default" size="sm">
                <Link
                    href={show(execution.id)}
                    onClick={(event) => event.stopPropagation()}
                >
                    <ListChecksIcon data-icon="inline-start" />
                    {t('jobs.details')}
                </Link>
            </Button>

            <DeleteJobButton execution={execution} redirectBack />
        </div>
    );
}
```

- [ ] **Step 7: Run frontend type check**

Run:

```bash
bun run types:check
```

Expected: PASS.

- [ ] **Step 8: Commit list integration**

Run:

```bash
git add resources/js/pages/process-executions/index.tsx resources/js/pages/admin/jobs/index.tsx
git commit -m "feat: show delete action in job lists"
```

---

### Task 5: Wire Delete Action Into Job Detail

**Files:**
- Modify: `resources/js/pages/process-executions/show.tsx`

- [ ] **Step 1: Import the shared component**

In `resources/js/pages/process-executions/show.tsx`, add:

```tsx
import { DeleteJobButton } from '@/components/ogc/delete-job-dialog';
```

- [ ] **Step 2: Add the delete button beside the job title/status**

In `resources/js/pages/process-executions/show.tsx`, find the `div` that wraps the `<h1>` and status `<Badge>`:

```tsx
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="min-w-0 text-2xl font-semibold">
                                    {execution.processTitle ??
                                        execution.processId}
                                </h1>
                                <Badge
```

Change that block so it includes `DeleteJobButton` after the status badge:

```tsx
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="min-w-0 text-2xl font-semibold">
                                    {execution.processTitle ??
                                        execution.processId}
                                </h1>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'shrink-0 tracking-wide',
                                        styles.badgeClassName,
                                    )}
                                >
                                    <StatusIcon data-icon="inline-start" />
                                    {jobStatusLabel(execution.status, t)}
                                </Badge>
                                <DeleteJobButton
                                    execution={execution}
                                    className="shrink-0"
                                />
                            </div>
```

- [ ] **Step 3: Run frontend type check**

Run:

```bash
bun run types:check
```

Expected: PASS.

- [ ] **Step 4: Commit detail integration**

Run:

```bash
git add resources/js/pages/process-executions/show.tsx
git commit -m "feat: show delete action on job detail"
```

---

### Task 6: Focused Verification

**Files:**
- Verify all changed backend and frontend behavior.

- [ ] **Step 1: Run PHP formatting**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: no unformatted PHP remains.

- [ ] **Step 2: Run focused backend tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionDeletionTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php tests/Feature/Admin/AdminJobManagementTest.php
```

Expected: PASS.

- [ ] **Step 3: Run frontend checks**

Run:

```bash
bun test tests/Frontend/i18n.test.ts
bun run types:check
```

Expected: PASS.

- [ ] **Step 4: Inspect route generation**

Run:

```bash
rg -n "destroy|jobs.destroy|DELETE /jobs" resources/js/routes/jobs/index.ts routes/web.php
```

Expected: output shows the Laravel `DELETE /jobs/{processExecution}` route and the generated Wayfinder `destroy` export.

- [ ] **Step 5: Check working tree**

Run:

```bash
git status --short
```

Expected: no unstaged changes after commits, or only intentional generated files that still need a final commit.

- [ ] **Step 6: Commit verification fallout if needed**

If Step 5 shows intentional formatting or generated-file changes, commit them:

```bash
git add app resources routes tests
git commit -m "chore: finalize job deletion"
```

Expected: final working tree is clean.

---

## Self-Review Notes

- Spec coverage: owners, admins, remote `204`, remote `404`, remote non-`404`, local-only deletion, cascade deletion, list/detail UI, and redirects are all covered by tasks.
- Placeholder scan: this plan contains exact file paths, concrete code, commands, and expected results.
- Type consistency: frontend uses `ProcessExecutionListItem`; `ProcessExecutionDetail` already extends it, so the shared delete component accepts all three usage contexts.
