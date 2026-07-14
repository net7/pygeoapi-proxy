# Admin Users Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline in the current workspace; do not create or use git worktrees.

**Goal:** Add simple user roles, admin user management, and read-only admin job visibility while preserving existing user job isolation.

**Architecture:** Add `role` and `deactivated_at` to `users`, cast `role` to a small enum, and enforce admin access server-side through policy/gate checks and Form Requests. Admin pages live under Inertia `resources/js/pages/admin/*`, use Wayfinder-generated routes, shadcn components, and Precognition validation. Existing OGC job detail/download flows are reused, with policy expansion for active admins.

**Tech Stack:** Laravel 13, PHP 8.4, Fortify, Socialite, Laravel passkeys, Inertia React 3, React 19, Wayfinder, shadcn/ui, Tailwind CSS 4, `laravel-precognition-react`, Pest 4.

---

## Implementation Notes

- Work inline in `/Users/nicola/Desktop/repository/pygeoapi-proxy/proxy`.
- Do not create a worktree.
- Before coding Laravel or Inertia APIs, run Laravel Boost `search-docs` for authorization, validation, Fortify reset links, and Precognition.
- Use `php artisan make:* --no-interaction` for generated Laravel classes.
- Use Pest tests first for backend behavior.
- Use shadcn components already installed; this plan does not require installing new shadcn components.
- After route changes, run `php artisan wayfinder:generate --with-form --no-interaction`.
- Format PHP with `vendor/bin/pint --dirty --format agent`.

## File Map

Create:

- `app/Enums/UserRole.php` - role enum with `User` and `Admin` cases.
- `database/migrations/<timestamp>_add_role_and_deactivated_at_to_users_table.php` - role and deactivation columns.
- `app/Console/Commands/MakeAdminUser.php` - `users:make-admin` bootstrap command.
- `app/Http/Controllers/Admin/UserController.php` - admin user CRUD, deactivate/reactivate/reset link.
- `app/Http/Controllers/Admin/JobController.php` - read-only global admin job list.
- `app/Http/Middleware/EnsureUserIsActive.php` - blocks authenticated inactive users from protected pages.
- `app/Http/Requests/Admin/StoreAdminUserRequest.php` - create user request.
- `app/Http/Requests/Admin/UpdateAdminUserRequest.php` - update user request.
- `app/Http/Requests/Admin/DeactivateAdminUserRequest.php` - deactivate request.
- `app/Http/Requests/Admin/ReactivateAdminUserRequest.php` - reactivate request.
- `app/Http/Requests/Admin/SendAdminUserPasswordResetLinkRequest.php` - reset-link request.
- `tests/Feature/Admin/UserRoleTest.php` - model, migration, factory checks.
- `tests/Feature/Admin/MakeAdminUserCommandTest.php` - CLI bootstrap checks.
- `tests/Feature/Admin/AdminUserManagementTest.php` - admin CRUD checks.
- `tests/Feature/Admin/AdminJobManagementTest.php` - admin global job checks.
- `tests/Feature/Auth/DeactivatedUserAuthenticationTest.php` - inactive auth checks.
- `resources/js/pages/admin/users/index.tsx` - admin users list.
- `resources/js/pages/admin/users/create.tsx` - create user page.
- `resources/js/pages/admin/users/edit.tsx` - edit user page.
- `resources/js/pages/admin/users/show.tsx` - user detail and user jobs.
- `resources/js/pages/admin/jobs/index.tsx` - global admin jobs list.
- `resources/js/components/admin/admin-user-form.tsx` - shared Precognition user form.
- `resources/js/types/admin.ts` - admin page prop types.

Modify:

- `app/Models/User.php` - role fillable/casts/helpers.
- `database/factories/UserFactory.php` - admin/deactivated states.
- `app/Http/Middleware/HandleInertiaRequests.php` - expose role/state/admin flags.
- `app/Providers/FortifyServiceProvider.php` - reject inactive password login.
- `app/Providers/AppServiceProvider.php` - register admin gate.
- `app/Actions/Auth/SocialUserResolver.php` - reject inactive reconciled users.
- `app/Http/Controllers/Auth/SocialAuthController.php` - render social inactive error path.
- `app/Policies/ProcessExecutionPolicy.php` - active admins can view all jobs.
- `routes/web.php` - admin routes and active-user middleware.
- `bootstrap/app.php` - middleware alias for active-user middleware.
- `resources/js/components/app-sidebar.tsx` - admin nav links.
- `resources/js/components/user-info.tsx` - uppercase `ADMIN` shadcn badge.
- `resources/js/types/auth.ts` - role and deactivation fields.
- `resources/js/types/index.ts` - export admin types.
- `tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php` - admin policy checks.
- `tests/Feature/Ogc/ProcessExecutionResultTest.php` - admin detail/download checks.
- `tests/Unit/ProcessUiLayoutTest.php` - static sidebar/admin badge checks.

---

### Task 1: User Role Data Model

**Files:**
- Create: `app/Enums/UserRole.php`
- Create: `database/migrations/<timestamp>_add_role_and_deactivated_at_to_users_table.php`
- Create: `tests/Feature/Admin/UserRoleTest.php`
- Modify: `app/Models/User.php`
- Modify: `database/factories/UserFactory.php`

- [ ] **Step 1: Generate migration and enum**

Run:

```bash
php artisan make:migration add_role_and_deactivated_at_to_users_table --table=users --no-interaction
```

Create `app/Enums/UserRole.php` with:

```php
<?php

namespace App\Enums;

enum UserRole: string
{
    case User = 'user';
    case Admin = 'admin';
}
```

- [ ] **Step 2: Write failing model tests**

Create `tests/Feature/Admin/UserRoleTest.php`:

```php
<?php

use App\Enums\UserRole;
use App\Models\User;

test('users are active regular users by default', function () {
    $user = User::factory()->create();

    expect($user->role)->toBe(UserRole::User)
        ->and($user->deactivated_at)->toBeNull()
        ->and($user->isAdmin())->toBeFalse()
        ->and($user->isActive())->toBeTrue()
        ->and($user->isDeactivated())->toBeFalse();
});

test('user factory can create admins', function () {
    $user = User::factory()->admin()->create();

    expect($user->role)->toBe(UserRole::Admin)
        ->and($user->isAdmin())->toBeTrue();
});

test('user factory can create deactivated users', function () {
    $user = User::factory()->deactivated()->create();

    expect($user->deactivated_at)->not->toBeNull()
        ->and($user->isActive())->toBeFalse()
        ->and($user->isDeactivated())->toBeTrue();
});
```

- [ ] **Step 3: Run model tests and verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Admin/UserRoleTest.php
```

Expected: FAIL because the migration/model helpers do not exist yet.

- [ ] **Step 4: Implement migration**

In the generated migration:

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->string('role')->default('user')->after('password')->index();
        $table->timestamp('deactivated_at')->nullable()->after('remember_token')->index();
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn(['role', 'deactivated_at']);
    });
}
```

- [ ] **Step 5: Implement User model role support**

Update `app/Models/User.php`:

```php
use App\Enums\UserRole;
```

Include `role` and `deactivated_at` in the `Fillable` attribute. Add methods:

```php
public function isAdmin(): bool
{
    return $this->role === UserRole::Admin;
}

public function isActive(): bool
{
    return $this->deactivated_at === null;
}

public function isDeactivated(): bool
{
    return ! $this->isActive();
}
```

Update casts:

```php
'role' => UserRole::class,
'deactivated_at' => 'datetime',
```

- [ ] **Step 6: Implement factory states**

Update `database/factories/UserFactory.php`:

```php
use App\Enums\UserRole;
```

Add default attributes:

```php
'role' => UserRole::User,
'deactivated_at' => null,
```

Add states:

```php
public function admin(): static
{
    return $this->state(fn (array $attributes) => [
        'role' => UserRole::Admin,
    ]);
}

public function deactivated(): static
{
    return $this->state(fn (array $attributes) => [
        'deactivated_at' => now(),
    ]);
}
```

- [ ] **Step 7: Verify model tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Admin/UserRoleTest.php
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/Enums/UserRole.php app/Models/User.php database/factories/UserFactory.php database/migrations tests/Feature/Admin/UserRoleTest.php
git commit -m "feat: add user roles and deactivation state"
```

---

### Task 2: Admin Bootstrap Command

**Files:**
- Create: `app/Console/Commands/MakeAdminUser.php`
- Create: `tests/Feature/Admin/MakeAdminUserCommandTest.php`

- [ ] **Step 1: Generate command**

Run:

```bash
php artisan make:command MakeAdminUser --command=users:make-admin --no-interaction
```

- [ ] **Step 2: Write failing command tests**

Create `tests/Feature/Admin/MakeAdminUserCommandTest.php`:

```php
<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;

test('make admin command promotes an existing user', function () {
    Notification::fake();
    $user = User::factory()->create(['email' => 'ada@example.org']);

    $this->artisan('users:make-admin', ['email' => 'ada@example.org'])
        ->assertSuccessful();

    expect($user->refresh()->role)->toBe(UserRole::Admin)
        ->and($user->deactivated_at)->toBeNull();

    Notification::assertNothingSent();
});

test('make admin command reactivates an existing user', function () {
    $user = User::factory()->deactivated()->create(['email' => 'ada@example.org']);

    $this->artisan('users:make-admin', ['email' => 'ada@example.org'])
        ->assertSuccessful();

    expect($user->refresh()->role)->toBe(UserRole::Admin)
        ->and($user->deactivated_at)->toBeNull();
});

test('make admin command creates a new admin and sends a reset link', function () {
    Notification::fake();

    $this->artisan('users:make-admin', ['email' => 'ada@example.org'])
        ->expectsOutputToContain('Created admin user')
        ->assertSuccessful();

    $user = User::query()->where('email', 'ada@example.org')->firstOrFail();

    expect($user->name)->toBe('ada@example.org')
        ->and($user->password)->toBeNull()
        ->and($user->role)->toBe(UserRole::Admin)
        ->and($user->deactivated_at)->toBeNull();

    Notification::assertSentTo($user, ResetPassword::class);
});
```

- [ ] **Step 3: Run command tests and verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Admin/MakeAdminUserCommandTest.php
```

Expected: FAIL because the command behavior is not implemented.

- [ ] **Step 4: Implement command**

Implement `app/Console/Commands/MakeAdminUser.php` with:

```php
<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class MakeAdminUser extends Command
{
    protected $signature = 'users:make-admin {email}';

    protected $description = 'Create or promote an active admin user by email.';

    public function handle(): int
    {
        $email = Str::lower((string) $this->argument('email'));
        $user = User::query()->where('email', $email)->first();

        if ($user !== null) {
            $user->forceFill([
                'role' => UserRole::Admin,
                'deactivated_at' => null,
            ])->save();

            $this->info("Promoted admin user: {$email}");

            return self::SUCCESS;
        }

        $user = User::query()->create([
            'name' => $email,
            'email' => $email,
            'password' => null,
            'email_verified_at' => now(),
            'role' => UserRole::Admin,
            'deactivated_at' => null,
        ]);

        $status = Password::sendResetLink(['email' => $email]);

        if ($status !== Password::ResetLinkSent) {
            $this->error(__($status));

            return self::FAILURE;
        }

        $this->info("Created admin user: {$email}");
        $this->info('Password reset link sent.');

        return self::SUCCESS;
    }
}
```

- [ ] **Step 5: Verify command tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Admin/MakeAdminUserCommandTest.php
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Console/Commands/MakeAdminUser.php tests/Feature/Admin/MakeAdminUserCommandTest.php
git commit -m "feat: add admin bootstrap command"
```

---

### Task 3: Deactivated User Authentication Guards

**Files:**
- Create: `app/Http/Middleware/EnsureUserIsActive.php`
- Create: `tests/Feature/Auth/DeactivatedUserAuthenticationTest.php`
- Modify: `app/Providers/FortifyServiceProvider.php`
- Modify: `app/Actions/Auth/SocialUserResolver.php`
- Modify: `app/Http/Controllers/Auth/SocialAuthController.php`
- Modify: `app/Http/Controllers/Auth/EmailOtpChallengeController.php`
- Modify: `routes/web.php`
- Modify: `bootstrap/app.php`

- [ ] **Step 1: Write failing auth tests**

Create `tests/Feature/Auth/DeactivatedUserAuthenticationTest.php`:

```php
<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('deactivated users cannot authenticate with password', function () {
    $user = User::factory()->deactivated()->create([
        'email' => 'ada@example.org',
        'password' => Hash::make('password'),
    ]);

    $this->post('/login', [
        'email' => 'ada@example.org',
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('deactivated authenticated users are logged out from protected pages', function () {
    $user = User::factory()->deactivated()->create();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertRedirect('/login');

    $this->assertGuest();
});

test('social resolver does not authenticate an existing deactivated account by verified email', function () {
    User::factory()->deactivated()->create(['email' => 'ada@example.org']);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-123',
        name: 'Ada Lovelace',
        email: 'ADA@example.org',
        emailVerified: true,
        avatar: null,
        raw: ['email_verified' => true],
    ));

    expect($result->status)->toBe('inactive');
    expect(SocialAccount::query()->count())->toBe(0);
});

test('social resolver does not authenticate an existing deactivated linked provider', function () {
    $user = User::factory()->deactivated()->create(['email' => 'ada@example.org']);
    SocialAccount::factory()->for($user)->create([
        'provider' => 'google',
        'provider_user_id' => 'google-123',
    ]);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-123',
        name: 'Ada Lovelace',
        email: 'ada@example.org',
        emailVerified: true,
        avatar: null,
        raw: ['email_verified' => true],
    ));

    expect($result->status)->toBe('inactive');
});

test('verified social email completion returns inactive for a deactivated account', function () {
    User::factory()->deactivated()->create(['email' => 'ada@example.org']);

    $result = app(SocialUserResolver::class)->completeVerifiedEmail(new ProviderProfile(
        provider: 'orcid',
        providerUserId: '0000-0002-1825-0097',
        name: 'Ada Lovelace',
        email: null,
        emailVerified: false,
        avatar: null,
        raw: [],
    ), 'ADA@example.org');

    expect($result->status)->toBe('inactive');
    expect(SocialAccount::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run auth tests and verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Auth/DeactivatedUserAuthenticationTest.php
```

Expected: FAIL because inactive auth handling does not exist.

- [ ] **Step 3: Add inactive social result**

Modify `app/Data/SocialLoginResult.php`:

```php
public const Inactive = 'inactive';

public static function inactive(User $user): self
{
    return new self(self::Inactive, user: $user);
}
```

- [ ] **Step 4: Update SocialUserResolver inactive checks**

In `resolve()`, after finding an existing account:

```php
if ($existingAccount !== null) {
    $this->refreshProvider($existingAccount, $profile);

    if ($existingAccount->user->isDeactivated()) {
        return SocialLoginResult::inactive($existingAccount->user);
    }

    return SocialLoginResult::authenticated($existingAccount->user);
}
```

Inside the verified-email transaction, after `firstOrCreate()` and before linking provider:

```php
if ($user->isDeactivated()) {
    return SocialLoginResult::inactive($user);
}
```

Change `completeVerifiedEmail()` to return `SocialLoginResult` instead of `User`. After resolving `$user`:

```php
if ($user->isDeactivated()) {
    return SocialLoginResult::inactive($user);
}
```

Return `SocialLoginResult::authenticated($user)` after linking the provider.

- [ ] **Step 5: Update SocialAuthController inactive result handling**

In `callback()`, after `NeedsEmail` handling and before `Auth::login()`:

```php
if ($result->status === SocialLoginResult::Inactive) {
    return to_route('login')->withErrors([
        'email' => __('These credentials do not match our records.'),
    ]);
}
```

Update `EmailOtpChallengeController::completeSocialLogin()` to work with `SocialLoginResult`:

```php
$result = $resolver->completeVerifiedEmail(
    ProviderProfile::fromPayload($payload),
    $challenge->email,
);

if ($result->status === SocialLoginResult::Inactive) {
    return to_route('login')->withErrors([
        'email' => __('These credentials do not match our records.'),
    ]);
}

Auth::login($result->user, remember: true);
```

- [ ] **Step 6: Update password authentication**

In `FortifyServiceProvider::configureActions()`, require active users:

```php
if ($user !== null
    && $user->isActive()
    && $user->password !== null
    && Hash::check((string) $request->input('password'), $user->password)) {
    return $user;
}
```

- [ ] **Step 7: Add active-user middleware**

Create `app/Http/Middleware/EnsureUserIsActive.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->isDeactivated()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return to_route('login')->withErrors([
                'email' => __('These credentials do not match our records.'),
            ]);
        }

        return $next($request);
    }
}
```

Register alias `active` in `bootstrap/app.php`, following the existing middleware configuration style. Apply it to authenticated route groups in `routes/web.php`:

```php
Route::middleware(['auth', 'active', 'verified'])->group(function () {
    // existing protected app routes
});
```

For `routes/settings.php`, add `active` to existing authenticated groups.

- [ ] **Step 8: Verify auth tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Auth/DeactivatedUserAuthenticationTest.php tests/Feature/Auth/SocialAuthTest.php tests/Feature/Auth/AuthenticationTest.php
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/Data/SocialLoginResult.php app/Actions/Auth/SocialUserResolver.php app/Http/Controllers/Auth/SocialAuthController.php app/Http/Controllers/Auth/EmailOtpChallengeController.php app/Http/Middleware/EnsureUserIsActive.php app/Providers/FortifyServiceProvider.php bootstrap/app.php routes/web.php routes/settings.php tests/Feature/Auth/DeactivatedUserAuthenticationTest.php
git commit -m "feat: block deactivated user authentication"
```

---

### Task 4: Admin User Backend

**Files:**
- Create: `app/Http/Controllers/Admin/UserController.php`
- Create: `app/Http/Requests/Admin/StoreAdminUserRequest.php`
- Create: `app/Http/Requests/Admin/UpdateAdminUserRequest.php`
- Create: `app/Http/Requests/Admin/DeactivateAdminUserRequest.php`
- Create: `app/Http/Requests/Admin/ReactivateAdminUserRequest.php`
- Create: `app/Http/Requests/Admin/SendAdminUserPasswordResetLinkRequest.php`
- Create: `tests/Feature/Admin/AdminUserManagementTest.php`
- Modify: `routes/web.php`
- Modify: `app/Providers/AppServiceProvider.php`

- [ ] **Step 1: Generate controller and requests**

Run:

```bash
php artisan make:controller Admin/UserController --no-interaction
php artisan make:request Admin/StoreAdminUserRequest --no-interaction
php artisan make:request Admin/UpdateAdminUserRequest --no-interaction
php artisan make:request Admin/DeactivateAdminUserRequest --no-interaction
php artisan make:request Admin/ReactivateAdminUserRequest --no-interaction
php artisan make:request Admin/SendAdminUserPasswordResetLinkRequest --no-interaction
```

- [ ] **Step 2: Write failing admin user tests**

Create `tests/Feature/Admin/AdminUserManagementTest.php` with tests named:

```php
test('non admins cannot access admin users index', function () { /* GET /admin/users => forbidden */ });
test('admins can view users index', function () { /* create admin and user, assert inertia admin/users/index */ });
test('admins can create users and send reset link', function () { /* Notification::fake, POST /admin/users */ });
test('admins can update users', function () { /* PATCH /admin/users/{user} */ });
test('admins cannot demote themselves', function () { /* PATCH self role user => session error */ });
test('admins can deactivate users and invalidate sessions', function () { /* session row deleted */ });
test('admins cannot deactivate themselves', function () { /* POST self deactivate => forbidden or validation error */ });
test('admins can reactivate users', function () { /* POST reactivate */ });
test('admins can send password reset links', function () { /* POST reset-link */ });
```

Use concrete route calls:

```php
$this->actingAs($admin)->get('/admin/users')->assertOk();
$this->actingAs($admin)->post('/admin/users', [...])->assertRedirect();
$this->actingAs($admin)->patch("/admin/users/{$user->id}", [...])->assertRedirect();
$this->actingAs($admin)->post("/admin/users/{$user->id}/deactivate")->assertRedirect();
$this->actingAs($admin)->post("/admin/users/{$user->id}/reactivate")->assertRedirect();
$this->actingAs($admin)->post("/admin/users/{$user->id}/password-reset-link")->assertRedirect();
```

- [ ] **Step 3: Run admin user tests and verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Admin/AdminUserManagementTest.php
```

Expected: FAIL because admin routes/controllers do not exist.

- [ ] **Step 4: Define admin gate**

In `AppServiceProvider::boot()`:

```php
Gate::define('admin', fn (User $user): bool => $user->isAdmin() && $user->isActive());
```

Add imports:

```php
use App\Models\User;
use Illuminate\Support\Facades\Gate;
```

- [ ] **Step 5: Add admin routes**

In `routes/web.php` inside auth/active/verified middleware:

```php
Route::middleware('can:admin')->prefix('admin')->name('admin.')->group(function () {
    Route::get('users', [AdminUserController::class, 'index'])->name('users.index');
    Route::get('users/create', [AdminUserController::class, 'create'])->name('users.create');
    Route::post('users', [AdminUserController::class, 'store'])->name('users.store');
    Route::get('users/{user}', [AdminUserController::class, 'show'])->name('users.show');
    Route::get('users/{user}/edit', [AdminUserController::class, 'edit'])->name('users.edit');
    Route::patch('users/{user}', [AdminUserController::class, 'update'])->name('users.update');
    Route::post('users/{user}/deactivate', [AdminUserController::class, 'deactivate'])->name('users.deactivate');
    Route::post('users/{user}/reactivate', [AdminUserController::class, 'reactivate'])->name('users.reactivate');
    Route::post('users/{user}/password-reset-link', [AdminUserController::class, 'sendPasswordResetLink'])->name('users.password-reset-link');
});
```

Alias the controller import:

```php
use App\Http\Controllers\Admin\UserController as AdminUserController;
```

- [ ] **Step 6: Implement Form Requests**

Common authorization:

```php
public function authorize(): bool
{
    return $this->user()?->can('admin') ?? false;
}
```

Create rules for store:

```php
return [
    'name' => ['required', 'string', 'max:255'],
    'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class, 'email')],
    'role' => ['required', Rule::enum(UserRole::class)],
];
```

Update rules use `Rule::unique(User::class, 'email')->ignore($this->user)` where `$this->route('user')` is the edited model. Add an `after()` validation hook that rejects self-demotion:

```php
if ($editedUser->is($this->user()) && $this->enum('role', UserRole::class) !== UserRole::Admin) {
    $validator->errors()->add('role', __('You cannot remove your own administrator role.'));
}
```

Deactivate request rejects self:

```php
return ! $this->route('user')->is($this->user());
```

Reactivate and reset-link requests authorize active admins.

- [ ] **Step 7: Implement UserController**

Controller methods:

- `index()` returns paginated users with filters and `process_executions_count`.
- `create()` returns role options.
- `store()` creates user with null password, active state, normalized lowercase email, sends reset link.
- `show()` returns user, social accounts summary, and user jobs.
- `edit()` returns user and role options.
- `update()` updates name/email/role.
- `deactivate()` sets `deactivated_at`, deletes session rows for that user id.
- `reactivate()` sets `deactivated_at` to null.
- `sendPasswordResetLink()` uses `Password::sendResetLink(['email' => $user->email])`.

Use:

```php
Inertia::render('admin/users/index', [...]);
Password::sendResetLink(['email' => $user->email]);
DB::table('sessions')->where('user_id', $user->id)->delete();
```

- [ ] **Step 8: Verify admin user backend tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Admin/AdminUserManagementTest.php
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/Http/Controllers/Admin/UserController.php app/Http/Requests/Admin app/Providers/AppServiceProvider.php routes/web.php tests/Feature/Admin/AdminUserManagementTest.php
git commit -m "feat: add admin user management backend"
```

---

### Task 5: Admin Job Backend And Policy Expansion

**Files:**
- Create: `app/Http/Controllers/Admin/JobController.php`
- Create: `tests/Feature/Admin/AdminJobManagementTest.php`
- Modify: `app/Policies/ProcessExecutionPolicy.php`
- Modify: `routes/web.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php`
- Modify: `tests/Feature/Ogc/ProcessExecutionResultTest.php`

- [ ] **Step 1: Generate controller**

Run:

```bash
php artisan make:controller Admin/JobController --no-interaction
```

- [ ] **Step 2: Write failing admin job tests**

Create `tests/Feature/Admin/AdminJobManagementTest.php`:

```php
<?php

use App\Models\ProcessExecution;
use App\Models\User;

test('non admins cannot access global admin jobs', function () {
    $this->actingAs(User::factory()->create())
        ->get('/admin/jobs')
        ->assertForbidden();
});

test('admins can view global jobs', function () {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create(['name' => 'Ada Lovelace']);
    $execution = ProcessExecution::factory()->for($owner)->create([
        'process_id' => 'solwcad',
        'process_title' => 'SOLW-CAD',
    ]);

    $this->actingAs($admin)
        ->get('/admin/jobs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/jobs/index')
            ->where('executions.data.0.id', $execution->id)
            ->where('executions.data.0.user.name', 'Ada Lovelace'));
});

test('admins can filter global jobs by user', function () {
    $admin = User::factory()->admin()->create();
    $first = User::factory()->create();
    $second = User::factory()->create();
    ProcessExecution::factory()->for($first)->create(['process_id' => 'first-process']);
    ProcessExecution::factory()->for($second)->create(['process_id' => 'second-process']);

    $this->actingAs($admin)
        ->get("/admin/jobs?user={$second->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('executions.data.0.processId', 'second-process'));
});
```

Update OGC authorization tests:

```php
test('admins can view another users execution', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->admin()->create();
    $execution = ProcessExecution::factory()->for($owner)->create();

    expect($admin->can('view', $execution))->toBeTrue();
});
```

- [ ] **Step 3: Run admin job tests and verify failure**

Run:

```bash
php artisan test --compact tests/Feature/Admin/AdminJobManagementTest.php tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php
```

Expected: FAIL because admin job route/policy behavior does not exist.

- [ ] **Step 4: Expand ProcessExecutionPolicy**

Update `view()`:

```php
return $user->isActive()
    && ($processExecution->user()->is($user) || $user->isAdmin());
```

- [ ] **Step 5: Add admin jobs route**

In the admin route group:

```php
Route::get('jobs', [AdminJobController::class, 'index'])->name('jobs.index');
```

Import:

```php
use App\Http\Controllers\Admin\JobController as AdminJobController;
```

- [ ] **Step 6: Implement JobController**

`index()` loads jobs globally:

```php
$executions = ProcessExecution::query()
    ->with(['user:id,name,email'])
    ->latest()
    ->when($request->integer('user'), fn ($query, int $userId) => $query->where('user_id', $userId))
    ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')->toString()))
    ->when($request->string('process')->isNotEmpty(), fn ($query) => $query->where('process_id', 'like', '%'.$request->string('process')->toString().'%'))
    ->paginate(15)
    ->withQueryString()
    ->through(fn (ProcessExecution $execution): array => [
        'id' => $execution->id,
        'remoteJobId' => $execution->remote_job_id,
        'processId' => $execution->process_id,
        'processTitle' => $execution->process_title,
        'status' => $execution->status->value,
        'progress' => $execution->progress,
        'message' => $execution->message,
        'createdAt' => $execution->created_at?->toIso8601String(),
        'submittedAt' => $execution->submitted_at?->toIso8601String(),
        'completedAt' => $execution->completed_at?->toIso8601String(),
        'failedAt' => $execution->failed_at?->toIso8601String(),
        'user' => [
            'id' => $execution->user->id,
            'name' => $execution->user->name,
            'email' => $execution->user->email,
        ],
    ]);
```

Render `admin/jobs/index` with `executions`, `filters`, and `users` for the user filter.

- [ ] **Step 7: Verify job backend tests pass**

Run:

```bash
php artisan test --compact tests/Feature/Admin/AdminJobManagementTest.php tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Admin/JobController.php app/Policies/ProcessExecutionPolicy.php routes/web.php tests/Feature/Admin/AdminJobManagementTest.php tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
git commit -m "feat: add admin job visibility"
```

---

### Task 6: Inertia Shared Auth Props And Sidebar Admin UI

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Modify: `resources/js/types/auth.ts`
- Modify: `resources/js/components/app-sidebar.tsx`
- Modify: `resources/js/components/user-info.tsx`
- Modify: `tests/Unit/ProcessUiLayoutTest.php`

- [ ] **Step 1: Write failing static UI tests**

Add tests to `tests/Unit/ProcessUiLayoutTest.php`:

```php
test('sidebar contains admin navigation items', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/app-sidebar.tsx');

    expect($source)
        ->toContain('Users')
        ->toContain('All Jobs')
        ->toContain('auth.user?.role ===');
});

test('user info renders uppercase admin badge with shadcn badge', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/user-info.tsx');

    expect($source)
        ->toContain("from '@/components/ui/badge'")
        ->toContain('<Badge')
        ->toContain('ADMIN');
});
```

- [ ] **Step 2: Run static UI tests and verify failure**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter=admin
```

Expected: FAIL because admin UI is not present.

- [ ] **Step 3: Expose auth role and active state**

In `HandleInertiaRequests::user()`, include:

```php
'role' => $user->role->value,
'is_admin' => $user->isAdmin(),
'deactivated_at' => $user->deactivated_at?->toIso8601String(),
'is_active' => $user->isActive(),
```

- [ ] **Step 4: Update TypeScript auth type**

In `resources/js/types/auth.ts`, add to `User`:

```ts
role: 'user' | 'admin';
is_admin: boolean;
deactivated_at: string | null;
is_active: boolean;
```

- [ ] **Step 5: Add uppercase shadcn badge**

In `resources/js/components/user-info.tsx`, import `Badge` and render:

```tsx
{user.role === 'admin' && (
    <Badge variant="secondary" className="w-fit text-[10px] uppercase">
        ADMIN
    </Badge>
)}
```

Keep layout stable by putting the badge inside the text column under or beside the name with `gap-1`.

- [ ] **Step 6: Add admin nav links**

In `resources/js/components/app-sidebar.tsx`, use `usePage()` and append admin links only when active admin:

```tsx
const { auth } = usePage().props;
const adminNavItems: NavItem[] = auth.user?.role === 'admin' && auth.user.is_active
    ? [
          { title: 'Users', href: adminUsersIndex(), icon: UsersIcon },
          { title: 'All Jobs', href: adminJobsIndex(), icon: ListChecksIcon },
      ]
    : [];
```

Render a second `NavMain` or extend `NavMain` to accept a label. Keep admin items separate enough that non-admins do not see them.

- [ ] **Step 7: Verify static UI tests pass**

Run:

```bash
php artisan test --compact tests/Unit/ProcessUiLayoutTest.php --filter=admin
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/types/auth.ts resources/js/components/app-sidebar.tsx resources/js/components/user-info.tsx tests/Unit/ProcessUiLayoutTest.php
git commit -m "feat: show admin navigation and badge"
```

---

### Task 7: Admin User Frontend Pages

**Files:**
- Create: `resources/js/types/admin.ts`
- Create: `resources/js/components/admin/admin-user-form.tsx`
- Create: `resources/js/pages/admin/users/index.tsx`
- Create: `resources/js/pages/admin/users/create.tsx`
- Create: `resources/js/pages/admin/users/edit.tsx`
- Create: `resources/js/pages/admin/users/show.tsx`
- Modify: `resources/js/types/index.ts`

- [ ] **Step 1: Regenerate Wayfinder routes**

Run:

```bash
php artisan wayfinder:generate --with-form --no-interaction
```

Expected: generated admin route and action files under `resources/js/routes/admin` and `resources/js/actions/App/Http/Controllers/Admin`.

- [ ] **Step 2: Add admin types**

Create `resources/js/types/admin.ts`:

```ts
import type { ProcessExecutionListItem } from './ogc';

export type AdminUserListItem = {
    id: number;
    name: string;
    email: string;
    role: 'user' | 'admin';
    isActive: boolean;
    deactivatedAt: string | null;
    processExecutionsCount: number;
    createdAt: string | null;
};

export type AdminUserDetail = AdminUserListItem & {
    socialAccounts: Array<{
        id: number;
        provider: string;
        providerEmail: string | null;
        providerEmailVerified: boolean;
    }>;
};

export type AdminUserFormData = {
    name: string;
    email: string;
    role: 'user' | 'admin';
};

export type AdminJobListItem = ProcessExecutionListItem & {
    user: {
        id: number;
        name: string;
        email: string;
    };
};
```

Export it from `resources/js/types/index.ts`.

- [ ] **Step 3: Build shared Precognition form**

Create `resources/js/components/admin/admin-user-form.tsx` using `useForm` from `laravel-precognition-react`, shadcn `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `Input`, `Select`, and `Button`.

Core pattern:

```tsx
const form = useForm(method, action, initialData);

function submit(event: React.FormEvent) {
    event.preventDefault();
    form.submit();
}
```

Each field:

```tsx
<Field data-invalid={form.invalid('email') || undefined}>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input
        id="email"
        value={form.data.email}
        onChange={(event) => form.setData('email', event.target.value)}
        onBlur={() => form.validate('email')}
        aria-invalid={form.invalid('email')}
    />
    {form.invalid('email') ? (
        <FieldDescription>{form.errors.email}</FieldDescription>
    ) : null}
</Field>
```

- [ ] **Step 4: Build users index page**

Create `resources/js/pages/admin/users/index.tsx` with:

- `Head title="Users"`;
- heading and `Create User` button;
- filter inputs for search/role/status;
- shadcn `Table`;
- `Badge` for role and active/deactivated state;
- row actions linking to show/edit and posting deactivate/reactivate/reset link.

- [ ] **Step 5: Build create/edit pages**

Create `create.tsx` and `edit.tsx` that use `AdminUserForm`.

Create uses POST action and empty initial data. Edit uses PATCH action and existing user data. The edit page receives backend prop `isSelf` and does not render a role selector that can demote the current admin when `isSelf` is true.

- [ ] **Step 6: Build user show page**

Create `show.tsx` with:

- profile summary;
- status and role badges;
- social accounts table;
- user job table using existing job formatting helpers from `@/lib/jobs`.

- [ ] **Step 7: Run TypeScript check and fix imports**

Run:

```bash
bun run types:check
```

Expected: PASS after fixing route/action import paths generated by Wayfinder.

- [ ] **Step 8: Commit**

```bash
git add resources/js/types resources/js/components/admin resources/js/pages/admin/users resources/js/routes resources/js/actions
git commit -m "feat: add admin user pages"
```

---

### Task 8: Admin Jobs Frontend Page

**Files:**
- Create: `resources/js/pages/admin/jobs/index.tsx`
- Modify: `resources/js/types/admin.ts`

- [ ] **Step 1: Build admin jobs page**

Create `resources/js/pages/admin/jobs/index.tsx` with:

- `Head title="All Jobs"`;
- filters for user/status/process;
- shadcn `Table`;
- user column;
- process/status/progress columns;
- link to existing job detail route `jobs.show`;
- `Badge` and `jobStatusStyles()` for status.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
bun run types:check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/admin/jobs/index.tsx resources/js/types/admin.ts
git commit -m "feat: add admin jobs page"
```

---

### Task 9: Full Verification

**Files:**
- Read: `git status --short`
- Read: `git diff --stat`
- Modify: files named by failing verification output before rerunning the same command.

- [ ] **Step 1: Run PHP admin/auth/OGC tests**

Run:

```bash
php artisan test --compact tests/Feature/Admin tests/Feature/Auth/DeactivatedUserAuthenticationTest.php tests/Feature/Auth/SocialAuthTest.php tests/Feature/Auth/AuthenticationTest.php tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php tests/Unit/ProcessUiLayoutTest.php
```

Expected: PASS.

- [ ] **Step 2: Format PHP**

Run:

```bash
vendor/bin/pint --dirty --format agent
```

Expected: no formatting errors; files may be modified by Pint.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
bun run types:check
```

Expected: PASS.

- [ ] **Step 4: Run full app tests**

Run:

```bash
php artisan test --compact
```

Expected: PASS.

- [ ] **Step 5: Review diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended admin/role files changed.

- [ ] **Step 6: Final commit**

If Pint or verification fixes changed files after the previous commits:

```bash
git add -A
git commit -m "test: verify admin users roles feature"
```

If there are no uncommitted changes, skip this commit and report that the worktree is clean.
