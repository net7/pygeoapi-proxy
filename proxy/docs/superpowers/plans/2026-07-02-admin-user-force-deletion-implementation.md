# Admin User Force Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate admin table action that permanently deletes a user and all local/remote user jobs after email confirmation.

**Architecture:** Implement a backend-first, job-first deletion flow. A dedicated `App\Actions\Admin\DeleteUser` action reuses `App\Actions\Ogc\DeleteProcessExecution` for each job, then clears sessions/avatar and deletes the user; a new form request validates the typed email; the React table gets a separate destructive modal wired through Wayfinder.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 4, Inertia React 3, Wayfinder, React 19, Tailwind CSS 4, shadcn/ui.

---

### File Structure

- Create `app/Actions/Admin/DeleteUser.php`: coordinates permanent user deletion after all jobs are deleted.
- Create `app/Http/Requests/Admin/ForceDeleteUserRequest.php`: validates admin access and `email_confirmation`.
- Modify `app/Http/Controllers/Admin/UserController.php`: add `forceDestroy()` and toast/error handling.
- Modify `routes/web.php`: add `DELETE /admin/users/{user}/force` named `admin.users.force-destroy`.
- Modify `tests/Feature/Admin/AdminUserManagementTest.php`: add failing feature coverage first.
- Regenerate `resources/js/routes/admin/users/index.ts` and `resources/js/actions/App/Http/Controllers/Admin/UserController.ts` with Wayfinder.
- Modify `resources/js/pages/admin/users/index.tsx`: add permanent delete action and modal.
- Modify `resources/js/lib/i18n/messages.ts`: add Italian/English labels and warnings.

### Task 1: Backend Red Tests

**Files:**
- Modify: `tests/Feature/Admin/AdminUserManagementTest.php`

- [ ] **Step 1: Add failing tests**

Add tests covering successful deletion, validation, self-delete, remote failure, and access control. Use `Http::preventStrayRequests()` in tests that exercise remote deletion.

```php
test('admins can permanently delete users and all related data', function () {
    config(['services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/']);
    Http::preventStrayRequests();
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-one' => Http::response(null, 204),
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-missing' => Http::response(['description' => 'Missing'], 404),
    ]);

    Storage::fake('public');
    Storage::disk('public')->put('avatars/target.jpg', 'avatar');

    $admin = User::factory()->admin()->create();
    $user = User::factory()->create([
        'email' => 'target@example.com',
        'avatar_path' => 'avatars/target.jpg',
    ]);
    $remoteExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-one']);
    $missingRemoteExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-missing']);
    $localExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => null]);
    ProcessExecutionResult::factory()->for($remoteExecution)->create();
    SocialAccount::factory()->for($user)->create();
    DB::table('passkeys')->insert([
        'user_id' => $user->id,
        'name' => 'Target passkey',
        'credential_id' => 'target-passkey-credential',
        'credential' => json_encode(['id' => 'target-passkey-credential']),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('sessions')->insert([
        'id' => 'force-delete-target-session',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Pest',
        'payload' => 'payload',
        'last_activity' => now()->timestamp,
    ]);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $user), [
            'email_confirmation' => 'target@example.com',
        ])
        ->assertRedirect(route('admin.users.index'));

    $this->assertModelMissing($user);
    $this->assertDatabaseMissing('process_executions', ['id' => $remoteExecution->id]);
    $this->assertDatabaseMissing('process_executions', ['id' => $missingRemoteExecution->id]);
    $this->assertDatabaseMissing('process_executions', ['id' => $localExecution->id]);
    $this->assertDatabaseMissing('sessions', ['id' => 'force-delete-target-session']);
    $this->assertDatabaseMissing('social_accounts', ['user_id' => $user->id]);
    $this->assertDatabaseMissing('passkeys', ['user_id' => $user->id]);
    Storage::disk('public')->assertMissing('avatars/target.jpg');

    Http::assertSentCount(2);
});

test('permanent user deletion requires matching email confirmation', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create(['email' => 'target@example.com']);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $user), [
            'email_confirmation' => 'wrong@example.com',
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertSessionHasErrors('email_confirmation');

    $this->assertModelExists($user);
});

test('admins cannot permanently delete themselves', function () {
    $admin = User::factory()->admin()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $admin), [
            'email_confirmation' => 'admin@example.com',
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertSessionHasErrors('user');

    $this->assertModelExists($admin);
});

test('remote job deletion failure stops permanent user deletion', function () {
    config(['services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/']);
    Http::preventStrayRequests();
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-one' => Http::response(null, 204),
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-failing' => Http::response(['description' => 'Unavailable'], 500),
    ]);

    $admin = User::factory()->admin()->create();
    $user = User::factory()->create(['email' => 'target@example.com']);
    $deletedExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-one']);
    $failingExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-failing']);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $user), [
            'email_confirmation' => 'target@example.com',
        ])
        ->assertRedirect(route('admin.users.index'));

    $this->assertModelExists($user);
    $this->assertDatabaseMissing('process_executions', ['id' => $deletedExecution->id]);
    $this->assertDatabaseHas('process_executions', ['id' => $failingExecution->id]);
});

test('normal users cannot permanently delete users', function () {
    $user = User::factory()->create();
    $target = User::factory()->create(['email' => 'target@example.com']);

    $this->actingAs($user)
        ->delete(route('admin.users.force-destroy', $target), [
            'email_confirmation' => 'target@example.com',
        ])
        ->assertForbidden();

    $this->assertModelExists($target);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `php artisan test --compact tests/Feature/Admin/AdminUserManagementTest.php --filter="permanently|permanent|normal users cannot permanently"`

Expected: failures because `admin.users.force-destroy` route does not exist.

### Task 2: Backend Implementation

**Files:**
- Create: `app/Actions/Admin/DeleteUser.php`
- Create: `app/Http/Requests/Admin/ForceDeleteUserRequest.php`
- Modify: `app/Http/Controllers/Admin/UserController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Create request scaffold**

Run: `php artisan make:request Admin/ForceDeleteUserRequest --no-interaction`

- [ ] **Step 2: Implement `ForceDeleteUserRequest`**

Use route model binding and validation `after()` to compare the submitted email with the target user and reject self-deletion with a `user` error.

- [ ] **Step 3: Implement `DeleteUser` action**

Delete jobs in ascending id order using `lazyById()`, then delete sessions, avatar, and the user.

- [ ] **Step 4: Add route and controller method**

Add `users/{user}/force` before the generic `users/{user}` route. Catch `ConnectionException|RequestException`, report the exception, and flash an Inertia error toast without deleting the user.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `php artisan test --compact tests/Feature/Admin/AdminUserManagementTest.php --filter="permanently|permanent|normal users cannot permanently"`

Expected: all new tests pass.

### Task 3: Wayfinder Generation

**Files:**
- Modify: `resources/js/routes/admin/users/index.ts`
- Modify: `resources/js/actions/App/Http/Controllers/Admin/UserController.ts`

- [ ] **Step 1: Regenerate Wayfinder definitions**

Run: `php artisan wayfinder:generate --with-form --no-interaction`

- [ ] **Step 2: Verify generated route exists**

Run: `rg -n "forceDestroy|force-destroy|/admin/users/\\{user\\}/force" resources/js/routes/admin/users/index.ts resources/js/actions/App/Http/Controllers/Admin/UserController.ts`

Expected: generated route/action helpers include the new endpoint.

### Task 4: Frontend Modal and Translations

**Files:**
- Modify: `resources/js/pages/admin/users/index.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`

- [ ] **Step 1: Add translation keys**

Add Italian and English keys under `admin` for permanent deletion title, warning, copy email, confirmation label, mismatch helper, and self-delete unavailable message.

- [ ] **Step 2: Add modal state and route import**

In `admin/users/index.tsx`, add `forceDeletingUser` state and import `forceDestroy` from `@/routes/admin/users`.

- [ ] **Step 3: Add row action button**

Add a destructive `Trash2Icon` button separate from deactivate/restore. For self rows, use the existing popover pattern.

- [ ] **Step 4: Add `ForceDeleteUserDialog`**

Use existing `Dialog`, `Alert`, `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `Input`, `Button`, and `Spinner` components. Use `useForm(forceDestroy(user.id), { email_confirmation: '' })` and submit with `form.submit({ preserveScroll: true, onSuccess: () => { onOpenChange(false); router.reload({ only: ['users'] }); } })` so validation errors remain visible.

- [ ] **Step 5: Run TypeScript**

Run: `bunx tsc --noEmit`

Expected: no type errors.

### Task 5: Formatting and Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Format PHP**

Run: `vendor/bin/pint --dirty --format agent`

- [ ] **Step 2: Run focused backend tests**

Run: `php artisan test --compact tests/Feature/Admin/AdminUserManagementTest.php tests/Feature/Ogc/ProcessExecutionDeletionTest.php`

- [ ] **Step 3: Run TypeScript again**

Run: `bunx tsc --noEmit`

- [ ] **Step 4: Inspect git diff**

Run: `git diff --stat && git diff --check`

Expected: no whitespace errors and only intended files changed.
