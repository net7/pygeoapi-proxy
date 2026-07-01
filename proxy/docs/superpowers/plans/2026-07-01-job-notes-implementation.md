# Job Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional rich-text notes to process execution jobs, editable by owners and admins at creation time and from the job detail page.

**Architecture:** Store a single sanitized Tiptap JSON document on `process_executions.note` with a dedicated `note_updated_at` timestamp. Use Laravel validation and a small sanitizer to keep only the note schema the UI supports, then expose `PATCH /jobs/{processExecution}/note` for owner/admin edits. Use one reusable Tiptap React editor and one reusable detail card/modal so the create and detail pages share behavior.

**Tech Stack:** Laravel 13, Pest 4, SQLite migrations, Inertia Laravel v3, Inertia React v3, Laravel Wayfinder, React 19, Tiptap React, Tiptap StarterKit, Tiptap Link, Tailwind CSS v4, shadcn/Radix dialog and toolbar primitives.

---

## File Structure

- Create `database/migrations/YYYY_MM_DD_HHMMSS_add_note_to_process_executions_table.php` to add `note` and `note_updated_at`.
- Create `app/Support/TiptapDocument.php` to sanitize, normalize, and size-check Tiptap JSON.
- Create `app/Http/Requests/Ogc/UpdateProcessExecutionNoteRequest.php` for the note update route.
- Modify `app/Http/Requests/Ogc/StoreProcessExecutionRequest.php` to accept optional `note`.
- Modify `app/Actions/Ogc/CreateProcessExecution.php` to store optional note data separately from the OGC payload.
- Modify `app/Models/ProcessExecution.php` to fill and cast the new fields.
- Modify `app/Policies/ProcessExecutionPolicy.php` to allow owners/admins to update job notes.
- Modify `app/Http/Controllers/Ogc/ProcessExecutionController.php` to pass note props and save note updates.
- Modify `routes/web.php` with `PATCH /jobs/{processExecution}/note`.
- Regenerate Wayfinder output in `resources/js/routes/jobs/**` and `resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionController.ts`.
- Create `resources/js/components/ogc/job-note-editor.tsx` for the reusable editable/read-only Tiptap surface.
- Create `resources/js/components/ogc/job-note-card.tsx` for the detail page rendered note and edit dialog.
- Modify `resources/js/components/ogc/dynamic-process-form.tsx` to include the create-page note editor.
- Modify `resources/js/pages/process-executions/show.tsx` to render the note card.
- Modify `resources/js/types/ogc.ts` with the note document type and detail props.
- Modify `resources/js/lib/i18n/messages.ts` with Italian and English note labels.
- Modify `tests/Feature/Ogc/ProcessExecutionTest.php` for create-time note tests.
- Create `tests/Feature/Ogc/ProcessExecutionNoteTest.php` for note update authorization and clearing.
- Modify `tests/Unit/ProcessUiLayoutTest.php` for static frontend layout checks.
- Modify `package.json` and lockfile by installing Tiptap packages.

---

### Task 1: Backend Note Tests

**Files:**
- Modify: `tests/Feature/Ogc/ProcessExecutionTest.php`
- Create: `tests/Feature/Ogc/ProcessExecutionNoteTest.php`

- [ ] **Step 1: Confirm Laravel docs before code changes**

Use Laravel Boost `search-docs` with these queries and packages:

```json
{
  "packages": ["laravel/framework", "inertiajs/inertia-laravel", "pestphp/pest"],
  "queries": ["form request validation after hook", "json column migration", "authorization policy update"],
  "token_limit": 6000
}
```

Expected: docs confirm FormRequest validation hooks, nullable JSON columns, policy authorization, and Pest feature test style for this Laravel version.

- [ ] **Step 2: Add create-time note tests**

Append these tests to `tests/Feature/Ogc/ProcessExecutionTest.php` after the first `starting a process creates an async local execution and redirects without remote submission` test:

```php
test('starting a process stores an optional user note without sending it to the remote payload', function () {
    Bus::fake();
    Http::preventStrayRequests();
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 10:15:00'));

    $user = User::factory()->create();
    $process = ogcFixture('process-conduit');
    app(OgcProcessCache::class)->putProcess('conduit', $process);

    $note = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => 'Check calibration before publishing results.'],
                ],
            ],
        ],
    ];

    $payload = [
        'inputs' => ['melt_composition' => ['value' => ['sio2' => 0.7, 'tio2' => 0.01]]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
        'note' => $note,
    ];

    $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), $payload);

    $execution = ProcessExecution::query()->sole();

    expect($execution->note)->toBe($note)
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T10:15:00+00:00');

    Bus::assertDispatched(SubmitProcessExecutionJob::class, fn (SubmitProcessExecutionJob $job): bool => $job->processExecutionId === $execution->id
        && ! array_key_exists('note', $job->payload)
        && $job->payload['inputs'] === $payload['inputs']
        && $job->payload['outputs'] === $payload['outputs']);
});

test('starting a process without a note leaves note timestamps empty', function () {
    Bus::fake();
    Http::preventStrayRequests();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess('conduit', ogcFixture('process-conduit'));

    $this->actingAs($user)->post(route('processes.jobs.store', 'conduit'), [
        'inputs' => ['melt_composition' => ['value' => ['sio2' => 0.7, 'tio2' => 0.01]]],
        'outputs' => ['gas' => ['transmissionMode' => 'value']],
    ]);

    $execution = ProcessExecution::query()->sole();

    expect($execution->note)->toBeNull()
        ->and($execution->note_updated_at)->toBeNull();
});
```

Add this import near the top of `tests/Feature/Ogc/ProcessExecutionTest.php`:

```php
use Carbon\Carbon;
use Carbon\CarbonImmutable;
```

- [ ] **Step 3: Create note update tests**

Create `tests/Feature/Ogc/ProcessExecutionNoteTest.php` with this complete content:

```php
<?php

use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;

function jobNoteDocument(string $text): array
{
    return [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => $text],
                ],
            ],
        ],
    ];
}

test('job owners can update notes while a job is still running', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 11:00:00'));

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'status' => ExecutionStatus::Running,
        'note' => null,
        'note_updated_at' => null,
    ]);

    $note = jobNoteDocument('Watch this run before sharing output.');

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->patch(route('jobs.note.update', $execution), ['note' => $note])
        ->assertRedirect(route('jobs.show', $execution))
        ->assertInertiaFlash('toast.title', 'Note saved');

    $execution->refresh();

    expect($execution->note)->toBe($note)
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T11:00:00+00:00');
});

test('admins can update notes for another users job', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 12:30:00'));

    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'note' => jobNoteDocument('Original owner note.'),
        'note_updated_at' => CarbonImmutable::parse('2026-07-01 08:00:00'),
    ]);

    $note = jobNoteDocument('Admin reviewed the running job.');

    $this->actingAs($admin)
        ->patch(route('jobs.note.update', $execution), ['note' => $note])
        ->assertRedirect();

    $execution->refresh();

    expect($execution->note)->toBe($note)
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T12:30:00+00:00');
});

test('users cannot update another users note', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'note' => jobNoteDocument('Owner note.'),
    ]);

    $this->actingAs($otherUser)
        ->patch(route('jobs.note.update', $execution), ['note' => jobNoteDocument('Tampered note.')])
        ->assertForbidden();

    expect($execution->refresh()->note)->toBe(jobNoteDocument('Owner note.'));
});

test('empty note updates clear the document and update the note timestamp', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 13:45:00'));

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'note' => jobNoteDocument('Remove this.'),
        'note_updated_at' => CarbonImmutable::parse('2026-07-01 09:00:00'),
    ]);

    $this->actingAs($user)
        ->patch(route('jobs.note.update', $execution), [
            'note' => [
                'type' => 'doc',
                'content' => [
                    [
                        'type' => 'paragraph',
                        'content' => [
                            ['type' => 'text', 'text' => '   '],
                        ],
                    ],
                ],
            ],
        ])
        ->assertRedirect();

    $execution->refresh();

    expect($execution->note)->toBeNull()
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T13:45:00+00:00');
});

test('oversized note documents are rejected', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $this->actingAs($user)
        ->patch(route('jobs.note.update', $execution), [
            'note' => jobNoteDocument(str_repeat('A', 70000)),
        ])
        ->assertSessionHasErrors('note');
});
```

- [ ] **Step 4: Run backend note tests to verify they fail**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter=note
php artisan test --compact tests/Feature/Ogc/ProcessExecutionNoteTest.php
```

Expected: FAIL because `note` columns, `jobs.note.update`, note validation, and note persistence do not exist yet.

- [ ] **Step 5: Commit the failing backend tests**

Run:

```bash
git add tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/ProcessExecutionNoteTest.php
git commit -m "test: cover process execution notes"
```

---

### Task 2: Backend Note Storage and Update Route

**Files:**
- Create: `database/migrations/YYYY_MM_DD_HHMMSS_add_note_to_process_executions_table.php`
- Create: `app/Support/TiptapDocument.php`
- Create: `app/Http/Requests/Ogc/UpdateProcessExecutionNoteRequest.php`
- Modify: `app/Http/Requests/Ogc/StoreProcessExecutionRequest.php`
- Modify: `app/Actions/Ogc/CreateProcessExecution.php`
- Modify: `app/Models/ProcessExecution.php`
- Modify: `app/Policies/ProcessExecutionPolicy.php`
- Modify: `app/Http/Controllers/Ogc/ProcessExecutionController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Create migration and request files with Artisan**

Run:

```bash
php artisan make:migration add_note_to_process_executions_table --table=process_executions --no-interaction
php artisan make:request Ogc/UpdateProcessExecutionNoteRequest --no-interaction
php artisan make:class Support/TiptapDocument --no-interaction
```

Expected: Laravel creates the migration, request, and support class files.

- [ ] **Step 2: Implement the migration**

Replace the generated migration content with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('process_executions', function (Blueprint $table): void {
            $table->json('note')->nullable()->after('message');
            $table->timestamp('note_updated_at')->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('process_executions', function (Blueprint $table): void {
            $table->dropColumn(['note', 'note_updated_at']);
        });
    }
};
```

- [ ] **Step 3: Implement Tiptap document sanitization**

Replace `app/Support/TiptapDocument.php` with:

```php
<?php

namespace App\Support;

class TiptapDocument
{
    public const MaxBytes = 65535;

    /**
     * @param  array<string, mixed>|null  $document
     * @return array{type: string, content?: list<array<string, mixed>>}|null
     */
    public static function sanitize(?array $document): ?array
    {
        if (($document['type'] ?? null) !== 'doc') {
            return null;
        }

        $content = self::sanitizeContent($document['content'] ?? []);
        $sanitized = ['type' => 'doc'];

        if ($content !== []) {
            $sanitized['content'] = $content;
        }

        return self::containsText($sanitized) ? $sanitized : null;
    }

    /**
     * @param  array<string, mixed>|null  $document
     */
    public static function byteLength(?array $document): int
    {
        $encoded = json_encode($document ?? [], JSON_THROW_ON_ERROR);

        return strlen($encoded);
    }

    /**
     * @param  mixed  $content
     * @return list<array<string, mixed>>
     */
    private static function sanitizeContent(mixed $content): array
    {
        if (! is_array($content)) {
            return [];
        }

        return collect($content)
            ->map(fn (mixed $node): ?array => is_array($node) ? self::sanitizeNode($node) : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $node
     * @return array<string, mixed>|null
     */
    private static function sanitizeNode(array $node): ?array
    {
        $type = $node['type'] ?? null;

        if ($type === 'text') {
            $text = (string) ($node['text'] ?? '');

            if ($text === '') {
                return null;
            }

            $sanitized = [
                'type' => 'text',
                'text' => $text,
            ];

            $marks = self::sanitizeMarks($node['marks'] ?? []);

            if ($marks !== []) {
                $sanitized['marks'] = $marks;
            }

            return $sanitized;
        }

        if ($type === 'hardBreak') {
            return ['type' => 'hardBreak'];
        }

        if (! in_array($type, ['paragraph', 'bulletList', 'orderedList', 'listItem', 'blockquote'], true)) {
            return null;
        }

        $sanitized = ['type' => $type];
        $content = self::sanitizeContent($node['content'] ?? []);

        if ($content !== []) {
            $sanitized['content'] = $content;
        }

        return $sanitized;
    }

    /**
     * @param  mixed  $marks
     * @return list<array<string, mixed>>
     */
    private static function sanitizeMarks(mixed $marks): array
    {
        if (! is_array($marks)) {
            return [];
        }

        return collect($marks)
            ->map(function (mixed $mark): ?array {
                if (! is_array($mark)) {
                    return null;
                }

                return match ($mark['type'] ?? null) {
                    'bold' => ['type' => 'bold'],
                    'italic' => ['type' => 'italic'],
                    'link' => self::sanitizeLinkMark($mark),
                    default => null,
                };
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $mark
     * @return array{type: string, attrs: array{href: string, target: string, rel: string}}|null
     */
    private static function sanitizeLinkMark(array $mark): ?array
    {
        $href = $mark['attrs']['href'] ?? null;

        if (! is_string($href)) {
            return null;
        }

        $href = trim($href);

        if ($href === '' || strlen($href) > 2048) {
            return null;
        }

        $scheme = parse_url($href, PHP_URL_SCHEME);

        if (! is_string($scheme) || ! in_array(strtolower($scheme), ['http', 'https', 'mailto'], true)) {
            return null;
        }

        return [
            'type' => 'link',
            'attrs' => [
                'href' => $href,
                'target' => '_blank',
                'rel' => 'noopener noreferrer nofollow',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function containsText(array $node): bool
    {
        if (($node['type'] ?? null) === 'text') {
            return trim((string) ($node['text'] ?? '')) !== '';
        }

        $content = $node['content'] ?? [];

        if (! is_array($content)) {
            return false;
        }

        foreach ($content as $child) {
            if (is_array($child) && self::containsText($child)) {
                return true;
            }
        }

        return false;
    }
}
```

- [ ] **Step 4: Implement the update request**

Replace `app/Http/Requests/Ogc/UpdateProcessExecutionNoteRequest.php` with:

```php
<?php

namespace App\Http\Requests\Ogc;

use App\Support\TiptapDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateProcessExecutionNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'note' => ['nullable', 'array'],
            'note.type' => ['required_with:note', 'string', 'in:doc'],
            'note.content' => ['sometimes', 'array'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $note = $this->input('note');

            if ($note === null) {
                return;
            }

            if (! is_array($note)) {
                return;
            }

            if (TiptapDocument::byteLength($note) > TiptapDocument::MaxBytes) {
                $validator->errors()->add('note', __('The note is too large.'));
            }
        });
    }

    /**
     * @return array<string, mixed>|null
     */
    public function note(): ?array
    {
        $note = $this->validated('note');

        return is_array($note) ? TiptapDocument::sanitize($note) : null;
    }
}
```

- [ ] **Step 5: Update the store request**

Modify `app/Http/Requests/Ogc/StoreProcessExecutionRequest.php`:

Add imports:

```php
use App\Support\TiptapDocument;
use Illuminate\Validation\Validator;
```

Extend `rules()`:

```php
return [
    'inputs' => ['required', 'array'],
    'outputs' => ['nullable', 'array'],
    'note' => ['nullable', 'array'],
    'note.type' => ['required_with:note', 'string', 'in:doc'],
    'note.content' => ['sometimes', 'array'],
];
```

Add these methods before `executionPayload()`:

```php
public function withValidator(Validator $validator): void
{
    $validator->after(function (Validator $validator): void {
        $note = $this->input('note');

        if ($note === null) {
            return;
        }

        if (! is_array($note)) {
            return;
        }

        if (TiptapDocument::byteLength($note) > TiptapDocument::MaxBytes) {
            $validator->errors()->add('note', __('The note is too large.'));
        }
    });
}

/**
 * @return array<string, mixed>|null
 */
public function note(): ?array
{
    $note = $this->validated('note');

    return is_array($note) ? TiptapDocument::sanitize($note) : null;
}
```

- [ ] **Step 6: Update the model**

Modify `app/Models/ProcessExecution.php`.

Add to `#[Fillable([...])]` after `message`:

```php
'note',
'note_updated_at',
```

Add to `casts()` after `message`-adjacent JSON casts:

```php
'note' => 'array',
'note_updated_at' => 'datetime',
```

- [ ] **Step 7: Update the create action**

Change `app/Actions/Ogc/CreateProcessExecution.php` method signature:

```php
public function handle(User $user, array $process, array $payload, ExecutionMode $mode, ?array $note = null): ProcessExecution
```

Add to the `ProcessExecution::create([...])` array after `message` or before `request_payload`:

```php
'note' => $note,
'note_updated_at' => $note === null ? null : now(),
```

- [ ] **Step 8: Update the policy**

Replace `update()` in `app/Policies/ProcessExecutionPolicy.php` with:

```php
public function update(User $user, ProcessExecution $processExecution): bool
{
    return $user->isAdmin() || $processExecution->user()->is($user);
}
```

- [ ] **Step 9: Update the controller**

Modify `app/Http/Controllers/Ogc/ProcessExecutionController.php`.

Add import:

```php
use App\Http\Requests\Ogc\UpdateProcessExecutionNoteRequest;
```

In `store()`, change the `CreateProcessExecution::handle()` call to:

```php
$execution = $createProcessExecution->handle(
    user: $user,
    process: $processDescription,
    payload: $payload,
    mode: $mode,
    note: $request->note(),
);
```

In `show()`, add these fields inside the `execution` prop after `message`:

```php
'note' => $processExecution->note,
'noteUpdatedAt' => $processExecution->note_updated_at?->toIso8601String(),
```

Add this method before `destroy()`:

```php
public function updateNote(UpdateProcessExecutionNoteRequest $request, ProcessExecution $processExecution): RedirectResponse
{
    Gate::authorize('update', $processExecution);

    $note = $request->note();

    $processExecution->forceFill([
        'note' => $note,
        'note_updated_at' => $note === null && $processExecution->note === null ? null : now(),
    ])->save();

    Inertia::flash('toast', [
        'type' => 'success',
        'title' => __('Note saved'),
        'message' => __('The job note has been saved.'),
        'icon' => false,
    ]);

    return back();
}
```

- [ ] **Step 10: Add the route**

Modify `routes/web.php` inside the authenticated job route group. Add the patch route between `jobs.show` and `jobs.destroy`:

```php
Route::patch('jobs/{processExecution}/note', [ProcessExecutionController::class, 'updateNote'])
    ->name('jobs.note.update');
```

- [ ] **Step 11: Run migrations and backend tests**

Run:

```bash
php artisan migrate --no-interaction
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter=note
php artisan test --compact tests/Feature/Ogc/ProcessExecutionNoteTest.php
```

Expected: PASS for the note-related backend tests.

- [ ] **Step 12: Format PHP and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter=note
php artisan test --compact tests/Feature/Ogc/ProcessExecutionNoteTest.php
git add app/Support/TiptapDocument.php app/Http/Requests/Ogc/StoreProcessExecutionRequest.php app/Http/Requests/Ogc/UpdateProcessExecutionNoteRequest.php app/Actions/Ogc/CreateProcessExecution.php app/Models/ProcessExecution.php app/Policies/ProcessExecutionPolicy.php app/Http/Controllers/Ogc/ProcessExecutionController.php routes/web.php database/migrations tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/ProcessExecutionNoteTest.php
git commit -m "feat: store editable job notes"
```

---

### Task 3: Wayfinder and Tiptap Dependencies

**Files:**
- Modify: `package.json`
- Modify: lockfile
- Generated: `resources/js/routes/jobs/**`
- Generated: `resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionController.ts`

- [ ] **Step 1: Install Tiptap packages**

Run:

```bash
bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

Expected: `package.json` and the lockfile include the three Tiptap packages.

- [ ] **Step 2: Regenerate Wayfinder output**

Run:

```bash
php artisan wayfinder:generate --no-interaction
```

Expected: generated route/action files include the `jobs.note.update` patch route, likely importable from `@/routes/jobs/note`.

- [ ] **Step 3: Verify generated route exists**

Run:

```bash
rg -n "note|updateNote|jobs.note.update" resources/js/routes resources/js/actions/App/Http/Controllers/Ogc/ProcessExecutionController.ts
```

Expected: output includes the generated note update route and controller action.

- [ ] **Step 4: Commit dependencies and generated routes**

Run:

```bash
git add package.json bun.lock resources/js/routes resources/js/actions
git commit -m "chore: add tiptap and regenerate routes"
```

If the lockfile is named differently in this project, stage the actual lockfile shown by `git status --short`.

---

### Task 4: Frontend Note Component Tests

**Files:**
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Add static layout assertions**

Append this test to `tests/Unit/ProcessUiLayoutTest.php`:

```php
test('job note editor appears on create and detail screens', function () {
    $formSource = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');
    $editorSource = file_get_contents(getcwd().'/resources/js/components/ogc/job-note-editor.tsx');
    $cardSource = file_get_contents(getcwd().'/resources/js/components/ogc/job-note-card.tsx');

    expect($formSource)
        ->toContain('@/components/ogc/job-note-editor')
        ->toContain("note: null")
        ->toContain("setData('note', note)");

    expect($showSource)
        ->toContain('@/components/ogc/job-note-card')
        ->toContain('<JobNoteCard execution={execution} />');

    expect($editorSource)
        ->toContain('@tiptap/react')
        ->toContain('@tiptap/starter-kit')
        ->toContain('@tiptap/extension-link')
        ->toContain('BoldIcon')
        ->toContain('ItalicIcon')
        ->toContain('ListIcon')
        ->toContain('ListOrderedIcon')
        ->toContain('QuoteIcon')
        ->toContain('LinkIcon')
        ->toContain('Undo2Icon')
        ->toContain('Redo2Icon');

    expect($cardSource)
        ->toContain('@/routes/jobs/note')
        ->toContain('DialogTitle')
        ->toContain("t('jobs.noteUpdatedAt')")
        ->toContain("t('jobs.editNote')");
});
```

- [ ] **Step 2: Run the layout test to verify it fails**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="job note editor"
```

Expected: FAIL because note components and imports do not exist yet.

- [ ] **Step 3: Commit the failing frontend layout test**

Run:

```bash
git add tests/Unit/ProcessUiLayoutTest.php
git commit -m "test: cover job note UI layout"
```

---

### Task 5: Tiptap Editor and Detail Note Card

**Files:**
- Create: `resources/js/components/ogc/job-note-editor.tsx`
- Create: `resources/js/components/ogc/job-note-card.tsx`
- Modify: `resources/js/types/ogc.ts`
- Modify: `resources/js/lib/i18n/messages.ts`

- [ ] **Step 1: Add frontend note types**

Modify `resources/js/types/ogc.ts`.

Add this type before `ProcessExecutionListItem`:

```ts
export type TiptapDocument = {
    type: 'doc';
    content?: Array<Record<string, unknown>>;
};
```

Add to `ProcessExecutionDetail`:

```ts
note?: TiptapDocument | null;
noteUpdatedAt?: string | null;
```

- [ ] **Step 2: Create the reusable Tiptap editor**

Create `resources/js/components/ogc/job-note-editor.tsx` with this complete content:

```tsx
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    BoldIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    QuoteIcon,
    Redo2Icon,
    Undo2Icon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { TiptapDocument } from '@/types';

const emptyDocument: TiptapDocument = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
        },
    ],
};

const noteExtensions = [
    StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
    }),
    Link.configure({
        autolink: false,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
        },
    }),
];

export function JobNoteEditor({
    value,
    onChange,
    readOnly = false,
    className,
}: {
    value?: TiptapDocument | null;
    onChange?: (note: TiptapDocument) => void;
    readOnly?: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const editor = useEditor({
        extensions: noteExtensions,
        content: (value ?? emptyDocument) as JSONContent,
        editable: !readOnly,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: cn(
                    'min-h-36 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'prose-note max-w-none',
                    readOnly && 'min-h-0 border-0 px-0 py-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                ),
            },
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getJSON() as TiptapDocument);
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const nextValue = value ?? emptyDocument;

        if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nextValue)) {
            editor.commands.setContent(nextValue as JSONContent, false);
        }
    }, [editor, value]);

    if (!editor) {
        return null;
    }

    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            {!readOnly ? (
                <TooltipProvider>
                    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                        <ToolbarButton
                            label={t('jobs.noteToolbar.undo')}
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={
                                !editor.can().chain().focus().undo().run()
                            }
                        >
                            <Undo2Icon />
                        </ToolbarButton>
                        <ToolbarButton
                            label={t('jobs.noteToolbar.redo')}
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={
                                !editor.can().chain().focus().redo().run()
                            }
                        >
                            <Redo2Icon />
                        </ToolbarButton>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.bold')}
                            pressed={editor.isActive('bold')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleBold().run()
                            }
                        >
                            <BoldIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.italic')}
                            pressed={editor.isActive('italic')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleItalic().run()
                            }
                        >
                            <ItalicIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.bulletList')}
                            pressed={editor.isActive('bulletList')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleBulletList().run()
                            }
                        >
                            <ListIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.orderedList')}
                            pressed={editor.isActive('orderedList')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleOrderedList().run()
                            }
                        >
                            <ListOrderedIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.blockquote')}
                            pressed={editor.isActive('blockquote')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleBlockquote().run()
                            }
                        >
                            <QuoteIcon />
                        </ToolbarToggle>
                        <ToolbarButton
                            label={t('jobs.noteToolbar.link')}
                            onClick={() => {
                                const currentHref =
                                    editor.getAttributes('link').href ?? '';
                                const href = window.prompt(
                                    t('jobs.noteLinkPrompt'),
                                    currentHref,
                                );

                                if (href === null) {
                                    return;
                                }

                                if (href.trim() === '') {
                                    editor.chain().focus().unsetLink().run();
                                    return;
                                }

                                editor
                                    .chain()
                                    .focus()
                                    .extendMarkRange('link')
                                    .setLink({ href: href.trim() })
                                    .run();
                            }}
                        >
                            <LinkIcon />
                        </ToolbarButton>
                    </div>
                </TooltipProvider>
            ) : null}

            <EditorContent editor={editor} />
        </div>
    );
}

function ToolbarButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    disabled={disabled}
                    onClick={onClick}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function ToolbarToggle({
    label,
    pressed,
    onPressedChange,
    children,
}: {
    label: string;
    pressed: boolean;
    onPressedChange: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Toggle
                    type="button"
                    size="sm"
                    pressed={pressed}
                    aria-label={label}
                    onPressedChange={onPressedChange}
                >
                    {children}
                </Toggle>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
```

- [ ] **Step 3: Add note content styling**

Modify `resources/css/app.css` by adding these component styles after the existing `@layer base` block:

```css
.prose-note p {
    margin-block: 0.5rem;
}

.prose-note p:first-child {
    margin-block-start: 0;
}

.prose-note p:last-child {
    margin-block-end: 0;
}

.prose-note ul {
    list-style: disc;
    margin-block: 0.5rem;
    padding-inline-start: 1.25rem;
}

.prose-note ol {
    list-style: decimal;
    margin-block: 0.5rem;
    padding-inline-start: 1.25rem;
}

.prose-note blockquote {
    border-inline-start: 2px solid var(--border);
    color: var(--muted-foreground);
    margin-block: 0.5rem;
    padding-inline-start: 0.75rem;
}

.prose-note a {
    color: var(--primary);
    text-decoration-line: underline;
    text-underline-offset: 3px;
}
```

- [ ] **Step 4: Create the detail note card**

Create `resources/js/components/ogc/job-note-card.tsx` with this complete content:

```tsx
import { useForm } from '@inertiajs/react';
import { FileTextIcon, PencilIcon } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { JobNoteEditor } from '@/components/ogc/job-note-editor';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { formatJobDate } from '@/lib/jobs';
import { update } from '@/routes/jobs/note';
import type { ProcessExecutionDetail, TiptapDocument } from '@/types';

type NoteForm = {
    note: TiptapDocument | null;
};

export function JobNoteCard({
    execution,
}: {
    execution: ProcessExecutionDetail;
}) {
    const { locale, t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data, setData, patch, processing, reset } = useForm<NoteForm>({
        note: execution.note ?? null,
    });

    useEffect(() => {
        if (open) {
            setData('note', execution.note ?? null);
        }
    }, [execution.note, open, setData]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        patch(update(execution.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    }

    return (
        <Card className="min-w-0 shadow-sm dark:border-border/70 dark:bg-card/95">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <CardTitle>{t('jobs.note')}</CardTitle>
                    <CardDescription>
                        {execution.noteUpdatedAt
                            ? t('jobs.noteUpdatedAt', {
                                  date: formatJobDate(
                                      execution.noteUpdatedAt,
                                      locale,
                                      t('common.notAvailable'),
                                  ),
                              })
                            : t('jobs.noteDescription')}
                    </CardDescription>
                </div>

                <Dialog
                    open={open}
                    onOpenChange={(nextOpen) => {
                        setOpen(nextOpen);

                        if (!nextOpen) {
                            reset();
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                            <PencilIcon data-icon="inline-start" />
                            {t('jobs.editNote')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <form className="flex flex-col gap-4" onSubmit={submit}>
                            <DialogHeader>
                                <DialogTitle>{t('jobs.editNote')}</DialogTitle>
                                <DialogDescription>
                                    {t('jobs.editNoteDescription')}
                                </DialogDescription>
                            </DialogHeader>

                            <JobNoteEditor
                                value={data.note}
                                onChange={(note) => setData('note', note)}
                            />

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? (
                                        <Spinner data-icon="inline-start" />
                                    ) : null}
                                    {t('jobs.saveNote')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {execution.note ? (
                    <JobNoteEditor value={execution.note} readOnly />
                ) : (
                    <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground dark:bg-muted/60">
                        <FileTextIcon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <p>{t('jobs.noNote')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 5: Add localization strings**

Modify `resources/js/lib/i18n/messages.ts`.

Add these keys inside the Italian `jobs` object:

```ts
editNote: 'Modifica nota',
editNoteDescription:
    'Aggiorna la nota del lavoro. Puoi modificarla anche mentre il lavoro è in corso.',
noNote: 'Nessuna nota salvata per questo lavoro.',
note: 'Nota',
noteDescription: 'Nota utente opzionale per questo lavoro.',
noteLinkPrompt: 'URL del link',
noteSaved: 'Nota salvata',
noteUpdatedAt: 'Aggiornata {date}',
saveNote: 'Salva nota',
noteToolbar: {
    blockquote: 'Citazione',
    bold: 'Grassetto',
    bulletList: 'Lista puntata',
    italic: 'Corsivo',
    link: 'Link',
    orderedList: 'Lista numerata',
    redo: 'Ripeti',
    undo: 'Annulla',
},
```

Add these keys inside the English `jobs` object:

```ts
editNote: 'Edit note',
editNoteDescription:
    'Update the job note. You can edit it while the job is still running.',
noNote: 'No note saved for this job.',
note: 'Note',
noteDescription: 'Optional user note for this job.',
noteLinkPrompt: 'Link URL',
noteSaved: 'Note saved',
noteUpdatedAt: 'Updated {date}',
saveNote: 'Save note',
noteToolbar: {
    blockquote: 'Quote',
    bold: 'Bold',
    bulletList: 'Bullet list',
    italic: 'Italic',
    link: 'Link',
    orderedList: 'Numbered list',
    redo: 'Redo',
    undo: 'Undo',
},
```

- [ ] **Step 6: Run frontend layout test to verify partial progress**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="job note editor"
```

Expected: still FAIL until create/detail pages import the new components.

---

### Task 6: Create Form and Detail Page Integration

**Files:**
- Modify: `resources/js/components/ogc/dynamic-process-form.tsx`
- Modify: `resources/js/pages/process-executions/show.tsx`

- [ ] **Step 1: Integrate the note editor in the create form**

Modify `resources/js/components/ogc/dynamic-process-form.tsx`.

Add import:

```tsx
import { JobNoteEditor } from '@/components/ogc/job-note-editor';
import type { TiptapDocument } from '@/types';
```

Update `FormData`:

```tsx
type FormData = {
    inputs: Record<string, any>;
    outputs: Record<string, { transmissionMode: string }>;
    note: TiptapDocument | null;
};
```

Add `note: null` to the `useForm<FormData>()` initial data:

```tsx
note: null,
```

Replace the current `<aside>` block with:

```tsx
<aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
    <Card className="min-w-0">
        <CardHeader>
            <CardTitle>{t('ogc.outputs')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
            <OutputSelector
                outputs={schema.outputs}
                value={data.outputs}
                onChange={(outputs) => setData('outputs', outputs)}
            />
        </CardContent>
    </Card>

    <Card className="min-w-0">
        <CardHeader>
            <CardTitle>{t('jobs.note')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
            <JobNoteEditor
                value={data.note}
                onChange={(note) => setData('note', note)}
            />
        </CardContent>
    </Card>

    <Button type="submit" disabled={processing} className="w-full">
        {processing ? (
            <Spinner data-icon="inline-start" />
        ) : (
            <PlayIcon data-icon="inline-start" />
        )}
        {t('ogc.execute')}
    </Button>
</aside>
```

- [ ] **Step 2: Integrate the note card in the detail page**

Modify `resources/js/pages/process-executions/show.tsx`.

Add import:

```tsx
import { JobNoteCard } from '@/components/ogc/job-note-card';
```

In the right-side `<aside>` inside the main grid, add this between the job summary card and the request card:

```tsx
<JobNoteCard execution={execution} />
```

- [ ] **Step 3: Run the frontend layout test**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="job note editor"
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript check and fix import issues**

Run:

```bash
bunx tsc --noEmit
```

Expected: PASS. If the generated note route exports a different import path than `@/routes/jobs/note`, update `resources/js/components/ogc/job-note-card.tsx` to match the generated Wayfinder path and rerun the command.

- [ ] **Step 5: Commit frontend integration**

Run:

```bash
git add resources/js/components/ogc/job-note-editor.tsx resources/js/components/ogc/job-note-card.tsx resources/js/components/ogc/dynamic-process-form.tsx resources/js/pages/process-executions/show.tsx resources/js/types/ogc.ts resources/js/lib/i18n/messages.ts resources/css/app.css tests/Unit/ProcessUiLayoutTest.php
git commit -m "feat: add job note editor UI"
```

---

### Task 7: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php --filter=note
php artisan test --compact tests/Feature/Ogc/ProcessExecutionNoteTest.php
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend/layout test**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter="job note editor"
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run PHP formatter and verify no dirty formatting remains**

Run:

```bash
vendor/bin/pint --dirty --format agent
git status --short
```

Expected: no PHP formatting changes remain unstaged. If Pint changes PHP files, stage and commit those formatting changes with the relevant implementation commit.

- [ ] **Step 5: Run the minimum broader regression tests**

Run:

```bash
php artisan test --compact tests/Feature/Ogc/ProcessExecutionTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php tests/Feature/Admin/AdminJobManagementTest.php tests/Unit/ProcessUiLayoutTest.php
```

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: worktree is clean after commits, and recent commits show the note test, backend, dependency/route, UI test, and UI implementation commits.

---

## Self-Review

- Spec coverage: create-page note, detail render, edit modal, owner/admin authorization, in-progress edit support, dedicated note timestamp, no list integration, backend tests, and layout tests are each covered by a task.
- Placeholder scan: this plan intentionally names files, methods, commands, expected results, and concrete code blocks for every code-producing step.
- Type consistency: backend uses `note` and `note_updated_at`; Inertia props use `note` and `noteUpdatedAt`; frontend uses `TiptapDocument`; route name is `jobs.note.update`.
