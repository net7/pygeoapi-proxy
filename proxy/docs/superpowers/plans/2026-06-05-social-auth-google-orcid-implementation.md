# Social Auth Google And ORCID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement feature-gated Google and ORCID authentication with mandatory verified email, OTP completion, and future-compatible Fortify internal auth.

**Architecture:** Keep Fortify as the session/logout/internal-auth foundation and add a separate social-auth layer for provider login. Provider profiles are normalized into a DTO, resolved through one account-linking service, and fall back to email OTP challenges when no trusted email is available. Feature flags live in `config/fortify.php` using Fortify native features plus application-owned `AuthFeatures` strings.

**Tech Stack:** Laravel 13, Fortify 1, Inertia React 3, Pest 4, SocialiteProviders Google, Laravel notifications, signed routes, SQLite-compatible migrations.

---

## Pre-Execution Notes

- The worktree already contains unrelated local edits. Stage and commit only files touched by the active task.
- Run Laravel documentation lookups with Boost `search-docs` before implementation code changes that use Laravel APIs.
- Run `vendor/bin/pint --dirty --format agent` after PHP edits.
- Run focused tests after each task, for example `php artisan test --compact --filter=AuthFeatures`.
- ORCID credentials shared during brainstorming must be regenerated before real use.

## File Structure

Create:

- `app/Support/AuthFeatures.php`: application auth feature flags.
- `app/Models/SocialAccount.php`: provider identity links.
- `app/Models/EmailOtpChallenge.php`: OTP state and challenge route key.
- `app/Data/ProviderProfile.php`: normalized provider profile DTO.
- `app/Data/SocialLoginResult.php`: resolver result object.
- `app/Actions/Auth/SocialUserResolver.php`: create, link, or ask for OTP.
- `app/Services/Auth/EmailOtpService.php`: OTP creation, delivery, verification.
- `app/Notifications/EmailOtpNotification.php`: email containing signed link and OTP code.
- `app/Http/Controllers/Auth/SocialAuthController.php`: provider redirect and callback.
- `app/Http/Controllers/Auth/SocialEmailController.php`: email collection for pending provider profile.
- `app/Http/Controllers/Auth/EmailOtpChallengeController.php`: signed verification page, code submit, resend.
- `app/Http/Controllers/Settings/SensitiveConfirmationController.php`: OTP confirmation for social-only sensitive actions.
- `app/Services/Auth/OrcidOAuthClient.php`: ORCID authorize/token/userinfo integration.
- `app/Providers/SocialiteServiceProvider.php`: Google SocialiteProviders listener.
- `database/migrations/*_make_users_password_nullable.php`
- `database/migrations/*_create_social_accounts_table.php`
- `database/migrations/*_create_email_otp_challenges_table.php`
- `database/factories/SocialAccountFactory.php`
- `database/factories/EmailOtpChallengeFactory.php`
- `tests/Feature/Auth/AuthFeaturesTest.php`
- `tests/Feature/Auth/SocialAuthTest.php`
- `tests/Feature/Auth/EmailOtpChallengeTest.php`
- `tests/Feature/Settings/SensitiveConfirmationTest.php`
- `tests/Unit/Auth/SocialUserResolverTest.php`
- `tests/Unit/Auth/EmailOtpServiceTest.php`
- `resources/js/pages/auth/social-email.tsx`
- `resources/js/pages/auth/verify-otp.tsx`

Modify:

- `composer.json` and `composer.lock`: install `socialiteproviders/google`.
- `bootstrap/providers.php`: register the Socialite provider service provider.
- `config/fortify.php`: enable app social features and keep native features comment-toggleable.
- `config/services.php`: add Google and ORCID service config.
- `.env.example`: add Google/ORCID variables.
- `routes/web.php`: add social auth, OTP, and sensitive confirmation routes.
- `app/Models/User.php`: nullable password expectations, relationships, and helper for local password.
- `database/factories/UserFactory.php`: add a social-only state.
- `app/Http/Middleware/HandleInertiaRequests.php`: expose social auth and OTP routes.
- `app/Providers/SocialiteServiceProvider.php`: register SocialiteProviders Google listener.
- `app/Providers/FortifyServiceProvider.php`: keep native auth routes feature-aware.
- `app/Http/Controllers/Settings/SecurityController.php`: expose OTP confirmation state/routes and hide password update for social-only users.
- `app/Http/Requests/Settings/ProfileDeleteRequest.php`: allow OTP confirmation for users without password.
- `app/Http/Requests/Settings/PasswordUpdateRequest.php`: reject password update for users without a current local password unless internal auth is enabled and a password setup flow exists.
- `resources/js/pages/auth/login.tsx`: provider-first UI with internal form only when enabled.
- `resources/js/pages/settings/security.tsx`: show password update only when usable.
- `resources/js/components/delete-user.tsx`: use OTP confirmation path for social-only users.
- `resources/js/types/auth.ts`: add social provider and OTP route types.
- Existing auth/settings tests: update assumptions around disabled Fortify features.

---

### Task 1: Dependencies, Feature Flags, And Service Config

**Files:**
- Create: `app/Support/AuthFeatures.php`
- Create: `tests/Feature/Auth/AuthFeaturesTest.php`
- Modify: `composer.json`
- Modify: `composer.lock`
- Modify: `config/fortify.php`
- Modify: `config/services.php`
- Modify: `.env.example`
- Create: `app/Providers/SocialiteServiceProvider.php`
- Modify: `bootstrap/providers.php`

- [ ] **Step 1: Install Google provider dependency**

Run:

```bash
composer require socialiteproviders/google --no-interaction
```

Expected: Composer updates `composer.json` and `composer.lock`, and package discovery completes without errors.

- [ ] **Step 2: Write the failing feature flag test**

Create `tests/Feature/Auth/AuthFeaturesTest.php`:

```php
<?php

use App\Support\AuthFeatures;

test('social auth features can be enabled through fortify features config', function () {
    config(['fortify.features' => [
        AuthFeatures::google(),
        AuthFeatures::emailOtp(),
    ]]);

    expect(AuthFeatures::enabled(AuthFeatures::google()))->toBeTrue()
        ->and(AuthFeatures::enabled(AuthFeatures::orcid()))->toBeFalse()
        ->and(AuthFeatures::enabled(AuthFeatures::emailOtp()))->toBeTrue();
});

test('enabled social providers returns only configured providers', function () {
    config(['fortify.features' => [
        AuthFeatures::orcid(),
    ]]);

    expect(AuthFeatures::enabledProviders())->toBe(['orcid']);
});
```

- [ ] **Step 3: Run the feature flag test and verify it fails**

Run:

```bash
php artisan test --compact --filter=AuthFeatures
```

Expected: FAIL because `App\Support\AuthFeatures` does not exist.

- [ ] **Step 4: Create the application feature helper**

Create `app/Support/AuthFeatures.php`:

```php
<?php

namespace App\Support;

class AuthFeatures
{
    public static function google(): string
    {
        return 'google-auth';
    }

    public static function orcid(): string
    {
        return 'orcid-auth';
    }

    public static function emailOtp(): string
    {
        return 'email-otp';
    }

    public static function enabled(string $feature): bool
    {
        return in_array($feature, config('fortify.features', []), true);
    }

    /**
     * @return list<string>
     */
    public static function enabledProviders(): array
    {
        return array_values(array_filter([
            self::enabled(self::google()) ? 'google' : null,
            self::enabled(self::orcid()) ? 'orcid' : null,
        ]));
    }

    public static function providerEnabled(string $provider): bool
    {
        return match ($provider) {
            'google' => self::enabled(self::google()),
            'orcid' => self::enabled(self::orcid()),
            default => false,
        };
    }
}
```

- [ ] **Step 5: Configure Fortify features and services**

Modify `config/fortify.php` imports:

```php
use App\Support\AuthFeatures;
use Laravel\Fortify\Features;
```

Set the `features` array:

```php
'features' => [
    // Features::registration(),
    // Features::resetPasswords(),
    // Features::passkeys([
    //     'confirmPassword' => true,
    // ]),

    AuthFeatures::google(),
    AuthFeatures::orcid(),
    AuthFeatures::emailOtp(),
],
```

Modify `config/services.php`:

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI'),
],

'orcid' => [
    'client_id' => env('ORCID_CLIENT_ID'),
    'client_secret' => env('ORCID_CLIENT_SECRET'),
    'redirect' => env('ORCID_REDIRECT_URI'),
    'base_url' => env('ORCID_BASE_URL', 'https://orcid.org'),
    'scope' => env('ORCID_SCOPE', 'openid'),
],
```

Add to `.env.example`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI="${APP_URL}/auth/google/callback"

ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=
ORCID_REDIRECT_URI="${APP_URL}/auth/orcid/callback"
ORCID_BASE_URL=https://orcid.org
ORCID_SCOPE=openid
```

- [ ] **Step 6: Register SocialiteProviders Google listener**

Register the dedicated provider in this project's `bootstrap/providers.php`.

Create `app/Providers/SocialiteServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Google\Provider;
use SocialiteProviders\Manager\SocialiteWasCalled;

class SocialiteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(function (SocialiteWasCalled $event): void {
            $event->extendSocialite('google', Provider::class);
        });
    }
}
```

Register it in `bootstrap/providers.php` by adding:

```php
App\Providers\SocialiteServiceProvider::class,
```

- [ ] **Step 7: Run and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=AuthFeatures
```

Expected: PASS for `AuthFeatures`.

Commit only this task's files:

```bash
git add composer.json composer.lock config/fortify.php config/services.php .env.example app/Support/AuthFeatures.php app/Providers/SocialiteServiceProvider.php bootstrap/providers.php tests/Feature/Auth/AuthFeaturesTest.php
git commit -m "feat: add auth feature flags"
```

---

### Task 2: Database Tables, Models, And Factories

**Files:**
- Create: `app/Models/SocialAccount.php`
- Create: `app/Models/EmailOtpChallenge.php`
- Create: `database/factories/SocialAccountFactory.php`
- Create: `database/factories/EmailOtpChallengeFactory.php`
- Create: `database/migrations/*_make_users_password_nullable.php`
- Create: `database/migrations/*_create_social_accounts_table.php`
- Create: `database/migrations/*_create_email_otp_challenges_table.php`
- Create: `tests/Feature/Auth/SocialAuthSchemaTest.php`
- Modify: `app/Models/User.php`
- Modify: `database/factories/UserFactory.php`

- [ ] **Step 1: Generate migration and model files**

Run:

```bash
php artisan make:model SocialAccount --factory --no-interaction
php artisan make:model EmailOtpChallenge --factory --no-interaction
php artisan make:migration make_users_password_nullable --table=users --no-interaction
php artisan make:migration create_social_accounts_table --create=social_accounts --no-interaction
php artisan make:migration create_email_otp_challenges_table --create=email_otp_challenges --no-interaction
php artisan make:test --pest SocialAuthSchemaTest --no-interaction
```

Expected: Laravel creates the model, factory, migration, and test files.

- [ ] **Step 2: Write the failing schema/model tests**

Replace `tests/Feature/Auth/SocialAuthSchemaTest.php`:

```php
<?php

use App\Models\EmailOtpChallenge;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

test('social auth tables are migrated', function () {
    expect(Schema::hasTable('social_accounts'))->toBeTrue()
        ->and(Schema::hasTable('email_otp_challenges'))->toBeTrue()
        ->and(Schema::hasColumn('users', 'password'))->toBeTrue();
});

test('user can have social accounts and nullable password', function () {
    $user = User::factory()->socialOnly()->create();

    $account = SocialAccount::factory()
        ->for($user)
        ->create([
            'provider' => 'google',
            'provider_user_id' => 'google-123',
        ]);

    expect($user->password)->toBeNull()
        ->and($user->socialAccounts()->first()->is($account))->toBeTrue()
        ->and($account->user->is($user))->toBeTrue()
        ->and($user->hasLocalPassword())->toBeFalse();
});

test('social account provider identity is unique', function () {
    $user = User::factory()->create();

    SocialAccount::factory()
        ->for($user)
        ->create([
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
        ]);

    expect(fn () => SocialAccount::factory()
        ->for($user)
        ->create([
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
        ]))->toThrow(QueryException::class);
});

test('otp challenge uses uuid as route key and casts payload', function () {
    $challenge = EmailOtpChallenge::factory()->create([
        'payload' => ['provider' => 'orcid'],
    ]);

    expect($challenge->getRouteKeyName())->toBe('uuid')
        ->and($challenge->payload)->toBe(['provider' => 'orcid']);
});
```

- [ ] **Step 3: Run the schema/model tests and verify they fail**

Run:

```bash
php artisan test --compact --filter=SocialAuthSchema
```

Expected: FAIL because tables, relationships, and factory states are not implemented.

- [ ] **Step 4: Implement migrations**

Use the generated timestamped migration for `make_users_password_nullable`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();
        });
    }
};
```

Use the generated migration for `create_social_accounts_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('provider_user_id');
            $table->string('provider_email')->nullable()->index();
            $table->boolean('provider_email_verified')->default(false);
            $table->string('name')->nullable();
            $table->string('avatar')->nullable();
            $table->json('raw_profile')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
```

Use the generated migration for `create_email_otp_challenges_table`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_otp_challenges', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('email')->index();
            $table->string('purpose')->index();
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at')->index();
            $table->timestamp('consumed_at')->nullable()->index();
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_otp_challenges');
    }
};
```

- [ ] **Step 5: Implement models and factories**

Replace `app/Models/SocialAccount.php`:

```php
<?php

namespace App\Models;

use Database\Factories\SocialAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'provider',
    'provider_user_id',
    'provider_email',
    'provider_email_verified',
    'name',
    'avatar',
    'raw_profile',
])]
class SocialAccount extends Model
{
    /** @use HasFactory<SocialAccountFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'provider_email_verified' => 'boolean',
            'raw_profile' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, SocialAccount>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

Replace `app/Models/EmailOtpChallenge.php`:

```php
<?php

namespace App\Models;

use Database\Factories\EmailOtpChallengeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'uuid',
    'email',
    'purpose',
    'code_hash',
    'attempts',
    'expires_at',
    'consumed_at',
    'payload',
])]
class EmailOtpChallenge extends Model
{
    /** @use HasFactory<EmailOtpChallengeFactory> */
    use HasFactory;

    public const PurposeSocialLogin = 'social-login';

    public const PurposeSensitiveConfirmation = 'sensitive-confirmation';

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
```

Modify `app/Models/User.php`:

```php
use Illuminate\Database\Eloquent\Relations\HasMany;
```

Update fillable:

```php
#[Fillable(['name', 'email', 'password'])]
```

Add methods:

```php
/**
 * @return HasMany<SocialAccount>
 */
public function socialAccounts(): HasMany
{
    return $this->hasMany(SocialAccount::class);
}

public function hasLocalPassword(): bool
{
    return filled($this->password);
}
```

Modify `database/factories/UserFactory.php` by adding:

```php
public function socialOnly(): static
{
    return $this->state(fn (array $attributes) => [
        'password' => null,
        'email_verified_at' => now(),
    ]);
}
```

Replace `database/factories/SocialAccountFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialAccount>
 */
class SocialAccountFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'provider' => 'google',
            'provider_user_id' => fake()->uuid(),
            'provider_email' => fake()->safeEmail(),
            'provider_email_verified' => true,
            'name' => fake()->name(),
            'avatar' => null,
            'raw_profile' => ['id' => fake()->uuid()],
        ];
    }
}
```

Replace `database/factories/EmailOtpChallengeFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\EmailOtpChallenge;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<EmailOtpChallenge>
 */
class EmailOtpChallengeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'email' => fake()->safeEmail(),
            'purpose' => EmailOtpChallenge::PurposeSocialLogin,
            'code_hash' => Hash::make('123456'),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'consumed_at' => null,
            'payload' => [],
        ];
    }
}
```

- [ ] **Step 6: Run and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan migrate:fresh --no-interaction
php artisan test --compact --filter=SocialAuthSchema
```

Expected: migrations run and tests PASS.

Commit only this task's files:

```bash
git add app/Models/User.php app/Models/SocialAccount.php app/Models/EmailOtpChallenge.php database/factories/UserFactory.php database/factories/SocialAccountFactory.php database/factories/EmailOtpChallengeFactory.php database/migrations tests/Feature/Auth/SocialAuthSchemaTest.php
git commit -m "feat: add social auth persistence"
```

---

### Task 3: Email OTP Service And Notification

**Files:**
- Create: `app/Services/Auth/EmailOtpService.php`
- Create: `app/Notifications/EmailOtpNotification.php`
- Create: `tests/Unit/Auth/EmailOtpServiceTest.php`
- Modify: `app/Models/EmailOtpChallenge.php`

- [ ] **Step 1: Generate notification and test**

Run:

```bash
php artisan make:notification EmailOtpNotification --no-interaction
php artisan make:test --pest EmailOtpServiceTest --unit --no-interaction
```

Expected: Laravel creates notification and unit test files.

- [ ] **Step 2: Write the failing OTP tests**

Replace `tests/Unit/Auth/EmailOtpServiceTest.php`:

```php
<?php

use App\Models\EmailOtpChallenge;
use App\Notifications\EmailOtpNotification;
use App\Services\Auth\EmailOtpService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

test('service creates challenge and sends on demand notification', function () {
    Notification::fake();

    $challenge = app(EmailOtpService::class)->createAndSend(
        email: 'Researcher@Example.ORG',
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        payload: ['provider' => 'orcid'],
        code: '123456',
    );

    expect($challenge->email)->toBe('researcher@example.org')
        ->and($challenge->purpose)->toBe(EmailOtpChallenge::PurposeSocialLogin)
        ->and($challenge->payload)->toBe(['provider' => 'orcid'])
        ->and(Hash::check('123456', $challenge->code_hash))->toBeTrue();

    Notification::assertSentOnDemand(EmailOtpNotification::class, function (EmailOtpNotification $notification) use ($challenge) {
        return $notification->challenge->is($challenge)
            && $notification->code === '123456'
            && str_contains($notification->signedUrl, '/verify/'.$challenge->uuid);
    });
});

test('service verifies valid code and consumes challenge', function () {
    $challenge = EmailOtpChallenge::factory()->create([
        'purpose' => EmailOtpChallenge::PurposeSocialLogin,
        'code_hash' => Hash::make('654321'),
    ]);

    $verified = app(EmailOtpService::class)->verify(
        challenge: $challenge,
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        code: '654321',
    );

    expect($verified)->toBeTrue()
        ->and($challenge->refresh()->consumed_at)->not->toBeNull();
});

test('service rejects invalid code and increments attempts', function () {
    $challenge = EmailOtpChallenge::factory()->create([
        'code_hash' => Hash::make('654321'),
    ]);

    $verified = app(EmailOtpService::class)->verify(
        challenge: $challenge,
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        code: '000000',
    );

    expect($verified)->toBeFalse()
        ->and($challenge->refresh()->attempts)->toBe(1)
        ->and($challenge->consumed_at)->toBeNull();
});

test('notification contains temporary signed url', function () {
    $challenge = EmailOtpChallenge::factory()->create();
    $signedUrl = URL::temporarySignedRoute('auth.otp.show', now()->addMinutes(10), ['challenge' => $challenge]);

    expect(URL::hasValidSignature(request()->create($signedUrl)))->toBeTrue();
});
```

- [ ] **Step 3: Run OTP tests and verify they fail**

Run:

```bash
php artisan test --compact --filter=EmailOtpService
```

Expected: FAIL because service, route name, and notification properties are not implemented.

- [ ] **Step 4: Add OTP verification helpers to model**

Modify `app/Models/EmailOtpChallenge.php`:

```php
public function canAttempt(): bool
{
    return ! $this->isConsumed()
        && ! $this->isExpired()
        && $this->attempts < 5;
}

public function consume(): void
{
    $this->forceFill([
        'consumed_at' => now(),
    ])->save();
}
```

- [ ] **Step 5: Implement notification**

Replace `app/Notifications/EmailOtpNotification.php`:

```php
<?php

namespace App\Notifications;

use App\Models\EmailOtpChallenge;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailOtpNotification extends Notification
{
    use Queueable;

    public function __construct(
        public EmailOtpChallenge $challenge,
        public string $code,
        public string $signedUrl,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('Your verification code'))
            ->line(__('Use this code to continue: :code', ['code' => $this->code]))
            ->action(__('Open verification page'), $this->signedUrl)
            ->line(__('This link and code expire shortly. If you did not request this, you can ignore this email.'));
    }
}
```

- [ ] **Step 6: Implement OTP service**

Create `app/Services/Auth/EmailOtpService.php`:

```php
<?php

namespace App\Services\Auth;

use App\Models\EmailOtpChallenge;
use App\Notifications\EmailOtpNotification;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class EmailOtpService
{
    /**
     * @param array<string, mixed> $payload
     */
    public function createAndSend(string $email, string $purpose, array $payload = [], ?string $code = null): EmailOtpChallenge
    {
        $normalizedEmail = Str::lower($email);
        $plainCode = $code ?? (string) random_int(100000, 999999);

        $challenge = EmailOtpChallenge::create([
            'uuid' => (string) Str::uuid(),
            'email' => $normalizedEmail,
            'purpose' => $purpose,
            'code_hash' => Hash::make($plainCode),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'payload' => $payload,
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'auth.otp.show',
            now()->addMinutes(10),
            ['challenge' => $challenge],
        );

        Notification::route('mail', $normalizedEmail)
            ->notify(new EmailOtpNotification($challenge, $plainCode, $signedUrl));

        return $challenge;
    }

    public function verify(EmailOtpChallenge $challenge, string $purpose, string $code): bool
    {
        if ($challenge->purpose !== $purpose || ! $challenge->canAttempt()) {
            return false;
        }

        if (! Hash::check($code, $challenge->code_hash)) {
            $challenge->increment('attempts');

            return false;
        }

        $challenge->consume();

        return true;
    }
}
```

- [ ] **Step 7: Add temporary route stub so signed URL tests can resolve**

In `routes/web.php`, add the route name that Task 5 will connect to a controller:

```php
Route::get('verify/{challenge}', fn () => null)
    ->middleware('signed')
    ->name('auth.otp.show');
```

Task 5 will replace the closure with `EmailOtpChallengeController::show`.

- [ ] **Step 8: Run and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=EmailOtpService
```

Expected: PASS.

Commit:

```bash
git add app/Models/EmailOtpChallenge.php app/Services/Auth/EmailOtpService.php app/Notifications/EmailOtpNotification.php routes/web.php tests/Unit/Auth/EmailOtpServiceTest.php
git commit -m "feat: add email otp service"
```

---

### Task 4: Provider Profile DTO And Social User Resolver

**Files:**
- Create: `app/Data/ProviderProfile.php`
- Create: `app/Data/SocialLoginResult.php`
- Create: `app/Actions/Auth/SocialUserResolver.php`
- Create: `tests/Unit/Auth/SocialUserResolverTest.php`

- [ ] **Step 1: Generate unit test**

Run:

```bash
php artisan make:test --pest SocialUserResolverTest --unit --no-interaction
```

Expected: Laravel creates the test file.

- [ ] **Step 2: Write failing resolver tests**

Replace `tests/Unit/Auth/SocialUserResolverTest.php`:

```php
<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\SocialAccount;
use App\Models\User;

test('existing social account resolves authenticated user', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create([
        'provider' => 'google',
        'provider_user_id' => 'google-1',
    ]);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-1',
        name: 'Ada Lovelace',
        email: 'ada@example.org',
        emailVerified: true,
        avatar: null,
        raw: ['sub' => 'google-1'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->is($user))->toBeTrue();
});

test('verified email links provider to existing user', function () {
    $user = User::factory()->create(['email' => 'ada@example.org']);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-2',
        name: 'Ada Lovelace',
        email: 'ADA@example.org',
        emailVerified: true,
        avatar: 'https://example.org/avatar.png',
        raw: ['sub' => 'google-2'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->is($user))->toBeTrue()
        ->and($user->socialAccounts()->where('provider', 'google')->exists())->toBeTrue();
});

test('verified new email creates social only user', function () {
    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-3',
        name: 'Grace Hopper',
        email: 'grace@example.org',
        emailVerified: true,
        avatar: null,
        raw: ['sub' => 'google-3'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->email)->toBe('grace@example.org')
        ->and($result->user->password)->toBeNull()
        ->and($result->user->email_verified_at)->not->toBeNull();
});

test('missing trusted email requires email collection', function () {
    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'orcid',
        providerUserId: '0000-0002-1825-0097',
        name: 'Researcher',
        email: null,
        emailVerified: false,
        avatar: null,
        raw: ['orcid' => '0000-0002-1825-0097'],
    ));

    expect($result->status)->toBe(SocialLoginResult::NeedsEmail)
        ->and($result->pendingProfile)->toBeArray();
});
```

- [ ] **Step 3: Run resolver tests and verify they fail**

Run:

```bash
php artisan test --compact --filter=SocialUserResolver
```

Expected: FAIL because DTO and resolver classes do not exist.

- [ ] **Step 4: Implement DTOs**

Create `app/Data/ProviderProfile.php`:

```php
<?php

namespace App\Data;

use Illuminate\Support\Str;

final readonly class ProviderProfile
{
    /**
     * @param array<string, mixed> $raw
     */
    public function __construct(
        public string $provider,
        public string $providerUserId,
        public ?string $name,
        public ?string $email,
        public bool $emailVerified,
        public ?string $avatar,
        public array $raw = [],
    ) {}

    public function normalizedEmail(): ?string
    {
        return $this->email === null ? null : Str::lower($this->email);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(): array
    {
        return [
            'provider' => $this->provider,
            'provider_user_id' => $this->providerUserId,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->emailVerified,
            'avatar' => $this->avatar,
            'raw' => $this->raw,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function fromPayload(array $payload): self
    {
        return new self(
            provider: (string) $payload['provider'],
            providerUserId: (string) $payload['provider_user_id'],
            name: $payload['name'] === null ? null : (string) $payload['name'],
            email: $payload['email'] === null ? null : (string) $payload['email'],
            emailVerified: (bool) $payload['email_verified'],
            avatar: $payload['avatar'] === null ? null : (string) $payload['avatar'],
            raw: is_array($payload['raw']) ? $payload['raw'] : [],
        );
    }
}
```

Create `app/Data/SocialLoginResult.php`:

```php
<?php

namespace App\Data;

use App\Models\User;

final readonly class SocialLoginResult
{
    public const Authenticated = 'authenticated';

    public const NeedsEmail = 'needs-email';

    /**
     * @param array<string, mixed>|null $pendingProfile
     */
    private function __construct(
        public string $status,
        public ?User $user = null,
        public ?array $pendingProfile = null,
    ) {}

    public static function authenticated(User $user): self
    {
        return new self(self::Authenticated, user: $user);
    }

    /**
     * @param array<string, mixed> $pendingProfile
     */
    public static function needsEmail(array $pendingProfile): self
    {
        return new self(self::NeedsEmail, pendingProfile: $pendingProfile);
    }
}
```

- [ ] **Step 5: Implement resolver**

Create `app/Actions/Auth/SocialUserResolver.php`:

```php
<?php

namespace App\Actions\Auth;

use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SocialUserResolver
{
    public function resolve(ProviderProfile $profile): SocialLoginResult
    {
        $existingAccount = SocialAccount::query()
            ->where('provider', $profile->provider)
            ->where('provider_user_id', $profile->providerUserId)
            ->first();

        if ($existingAccount !== null) {
            return SocialLoginResult::authenticated($existingAccount->user);
        }

        if ($profile->emailVerified && $profile->normalizedEmail() !== null) {
            return DB::transaction(function () use ($profile): SocialLoginResult {
                $user = User::query()->firstOrCreate(
                    ['email' => $profile->normalizedEmail()],
                    [
                        'name' => $profile->name ?: $profile->normalizedEmail(),
                        'password' => null,
                        'email_verified_at' => now(),
                    ],
                );

                if ($user->email_verified_at === null) {
                    $user->forceFill(['email_verified_at' => now()])->save();
                }

                $this->linkProvider($user, $profile);

                return SocialLoginResult::authenticated($user);
            });
        }

        return SocialLoginResult::needsEmail($profile->toPayload());
    }

    public function completeVerifiedEmail(ProviderProfile $profile, string $email): User
    {
        return DB::transaction(function () use ($profile, $email): User {
            $normalizedEmail = str($email)->lower()->toString();

            $user = User::query()->firstOrCreate(
                ['email' => $normalizedEmail],
                [
                    'name' => $profile->name ?: $normalizedEmail,
                    'password' => null,
                    'email_verified_at' => now(),
                ],
            );

            $user->forceFill(['email_verified_at' => now()])->save();
            $this->linkProvider($user, $profile, $normalizedEmail, true);

            return $user;
        });
    }

    private function linkProvider(User $user, ProviderProfile $profile, ?string $verifiedEmail = null, ?bool $emailVerified = null): SocialAccount
    {
        return SocialAccount::query()->create([
            'user_id' => $user->id,
            'provider' => $profile->provider,
            'provider_user_id' => $profile->providerUserId,
            'provider_email' => $verifiedEmail ?? $profile->normalizedEmail(),
            'provider_email_verified' => $emailVerified ?? $profile->emailVerified,
            'name' => $profile->name,
            'avatar' => $profile->avatar,
            'raw_profile' => $profile->raw,
        ]);
    }
}
```

- [ ] **Step 6: Run and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=SocialUserResolver
```

Expected: PASS.

Commit:

```bash
git add app/Data/ProviderProfile.php app/Data/SocialLoginResult.php app/Actions/Auth/SocialUserResolver.php tests/Unit/Auth/SocialUserResolverTest.php
git commit -m "feat: add social user resolver"
```

---

### Task 5: Social Auth And OTP Controllers

**Files:**
- Create: `app/Http/Controllers/Auth/SocialAuthController.php`
- Create: `app/Http/Controllers/Auth/SocialEmailController.php`
- Create: `app/Http/Controllers/Auth/EmailOtpChallengeController.php`
- Create: `app/Services/Auth/OrcidOAuthClient.php`
- Create: `tests/Feature/Auth/SocialAuthTest.php`
- Create: `tests/Feature/Auth/EmailOtpChallengeTest.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Generate controllers and tests**

Run:

```bash
php artisan make:controller Auth/SocialAuthController --no-interaction
php artisan make:controller Auth/SocialEmailController --no-interaction
php artisan make:controller Auth/EmailOtpChallengeController --no-interaction
php artisan make:class Services/Auth/OrcidOAuthClient --no-interaction
php artisan make:test --pest SocialAuthTest --no-interaction
php artisan make:test --pest EmailOtpChallengeTest --no-interaction
```

Expected: Laravel creates the files.

- [ ] **Step 2: Write route and controller feature tests**

Replace `tests/Feature/Auth/SocialAuthTest.php`:

```php
<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\User;
use App\Support\AuthFeatures;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery\MockInterface;

test('disabled provider redirects to login with error', function () {
    config(['fortify.features' => []]);

    $this->get(route('auth.social.redirect', ['provider' => 'google']))
        ->assertRedirect(route('login'));
});

test('google redirect uses socialite driver', function () {
    config(['fortify.features' => [AuthFeatures::google()]]);

    $redirect = redirect('https://accounts.google.com/o/oauth2/auth');

    $this->mock(SocialiteFactory::class, function (MockInterface $mock) use ($redirect) {
        $driver = Mockery::mock();
        $driver->shouldReceive('redirect')->once()->andReturn($redirect);
        $mock->shouldReceive('driver')->with('google')->once()->andReturn($driver);
    });

    $this->get(route('auth.social.redirect', ['provider' => 'google']))
        ->assertRedirect('https://accounts.google.com/o/oauth2/auth');
});

test('google callback logs in resolved user', function () {
    config(['fortify.features' => [AuthFeatures::google()]]);

    $user = User::factory()->create();
    $socialiteUser = (new SocialiteUser)
        ->setId('google-123')
        ->setName('Ada Lovelace')
        ->setEmail('ada@example.org')
        ->setAvatar(null);
    $socialiteUser->user = ['email_verified' => true];

    $this->mock(SocialiteFactory::class, function (MockInterface $mock) use ($socialiteUser) {
        $driver = Mockery::mock();
        $driver->shouldReceive('user')->once()->andReturn($socialiteUser);
        $mock->shouldReceive('driver')->with('google')->once()->andReturn($driver);
    });

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) use ($user) {
        $mock->shouldReceive('resolve')
            ->once()
            ->with(Mockery::on(fn (ProviderProfile $profile) => $profile->provider === 'google' && $profile->emailVerified === true))
            ->andReturn(SocialLoginResult::authenticated($user));
    });

    $this->get(route('auth.social.callback', ['provider' => 'google']))
        ->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($user);
});

test('callback requiring email stores pending profile', function () {
    config(['fortify.features' => [AuthFeatures::orcid(), AuthFeatures::emailOtp()]]);

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) {
        $mock->shouldReceive('resolve')
            ->once()
            ->andReturn(SocialLoginResult::needsEmail([
                'provider' => 'orcid',
                'provider_user_id' => '0000-0002-1825-0097',
                'name' => 'Researcher',
                'email' => null,
                'email_verified' => false,
                'avatar' => null,
                'raw' => [],
            ]));
    });

    $this->get(route('auth.social.callback', ['provider' => 'orcid']))
        ->assertRedirect(route('auth.social.email.create'))
        ->assertSessionHas('social_auth.pending_profile');
});
```

Replace `tests/Feature/Auth/EmailOtpChallengeTest.php`:

```php
<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Models\EmailOtpChallenge;
use App\Models\User;
use App\Services\Auth\EmailOtpService;
use App\Support\AuthFeatures;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

test('signed otp verification page renders', function () {
    $challenge = EmailOtpChallenge::factory()->create();

    $url = URL::temporarySignedRoute('auth.otp.show', now()->addMinutes(10), ['challenge' => $challenge]);

    $this->get($url)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/verify-otp')
            ->where('email', $challenge->email)
        );
});

test('otp submission completes pending social login', function () {
    config(['fortify.features' => [AuthFeatures::emailOtp()]]);

    $challenge = EmailOtpChallenge::factory()->create([
        'purpose' => EmailOtpChallenge::PurposeSocialLogin,
        'email' => 'researcher@example.org',
        'code_hash' => Hash::make('123456'),
        'payload' => [
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
            'name' => 'Researcher',
            'email' => null,
            'email_verified' => false,
            'avatar' => null,
            'raw' => [],
        ],
    ]);
    $user = User::factory()->socialOnly()->create(['email' => 'researcher@example.org']);

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) use ($user) {
        $mock->shouldReceive('completeVerifiedEmail')
            ->once()
            ->with(Mockery::type(ProviderProfile::class), 'researcher@example.org')
            ->andReturn($user);
    });

    $this->post(route('auth.otp.verify', ['challenge' => $challenge]), [
        'code' => '123456',
    ])->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($user);
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
php artisan test --compact --filter=SocialAuth
php artisan test --compact --filter=EmailOtpChallenge
```

Expected: FAIL because routes and controllers are not wired.

- [ ] **Step 4: Implement ORCID client**

Create `app/Services/Auth/OrcidOAuthClient.php`:

```php
<?php

namespace App\Services\Auth;

use App\Data\ProviderProfile;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;

class OrcidOAuthClient
{
    public function __construct(private HttpFactory $http) {}

    public function redirect(): RedirectResponse
    {
        $state = Str::random(40);
        session(['orcid_oauth_state' => $state]);

        return Redirect::away(config('services.orcid.base_url').'/oauth/authorize?'.http_build_query([
            'client_id' => config('services.orcid.client_id'),
            'response_type' => 'code',
            'scope' => config('services.orcid.scope', 'openid'),
            'redirect_uri' => config('services.orcid.redirect'),
            'state' => $state,
        ]));
    }

    public function user(string $code, string $state): ProviderProfile
    {
        abort_unless(hash_equals((string) session('orcid_oauth_state'), $state), 403);
        session()->forget('orcid_oauth_state');

        $token = $this->http
            ->asForm()
            ->post(config('services.orcid.base_url').'/oauth/token', [
                'client_id' => config('services.orcid.client_id'),
                'client_secret' => config('services.orcid.client_secret'),
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => config('services.orcid.redirect'),
            ])
            ->throw()
            ->json();

        $orcid = (string) ($token['orcid'] ?? $token['sub'] ?? '');

        return new ProviderProfile(
            provider: 'orcid',
            providerUserId: $orcid,
            name: $token['name'] ?? null,
            email: null,
            emailVerified: false,
            avatar: null,
            raw: $token,
        );
    }
}
```

- [ ] **Step 5: Implement controllers**

Create `app/Http/Controllers/Auth/SocialAuthController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Http\Controllers\Controller;
use App\Services\Auth\OrcidOAuthClient;
use App\Support\AuthFeatures;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;

class SocialAuthController extends Controller
{
    public function redirect(string $provider, SocialiteFactory $socialite, OrcidOAuthClient $orcid): RedirectResponse
    {
        if (! AuthFeatures::providerEnabled($provider)) {
            return to_route('login')->withErrors(['provider' => __('This sign-in provider is not available.')]);
        }

        if ($provider === 'orcid') {
            return $orcid->redirect();
        }

        return $socialite->driver($provider)->redirect();
    }

    public function callback(string $provider, Request $request, SocialiteFactory $socialite, OrcidOAuthClient $orcid, SocialUserResolver $resolver): RedirectResponse
    {
        if (! AuthFeatures::providerEnabled($provider)) {
            return to_route('login')->withErrors(['provider' => __('This sign-in provider is not available.')]);
        }

        $profile = $provider === 'orcid'
            ? $orcid->user((string) $request->query('code'), (string) $request->query('state'))
            : $this->googleProfile($socialite);

        $result = $resolver->resolve($profile);

        if ($result->status === SocialLoginResult::NeedsEmail) {
            $request->session()->put('social_auth.pending_profile', $result->pendingProfile);

            return to_route('auth.social.email.create');
        }

        Auth::login($result->user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    private function googleProfile(SocialiteFactory $socialite): ProviderProfile
    {
        $user = $socialite->driver('google')->user();
        $raw = $user->user;

        return new ProviderProfile(
            provider: 'google',
            providerUserId: (string) $user->getId(),
            name: $user->getName(),
            email: $user->getEmail(),
            emailVerified: (bool) ($raw['email_verified'] ?? false),
            avatar: $user->getAvatar(),
            raw: $raw,
        );
    }
}
```

Create `app/Http/Controllers/Auth/SocialEmailController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\EmailOtpChallenge;
use App\Services\Auth\EmailOtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SocialEmailController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        if (! $request->session()->has('social_auth.pending_profile')) {
            return to_route('login');
        }

        return Inertia::render('auth/social-email', [
            'email' => data_get($request->session()->get('social_auth.pending_profile'), 'email'),
            'submitUrl' => route('auth.social.email.store', absolute: false),
        ]);
    }

    public function store(Request $request, EmailOtpService $otp): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255'],
        ]);

        $pendingProfile = $request->session()->get('social_auth.pending_profile');

        if (! is_array($pendingProfile)) {
            return to_route('login');
        }

        $challenge = $otp->createAndSend(
            email: $validated['email'],
            purpose: EmailOtpChallenge::PurposeSocialLogin,
            payload: $pendingProfile,
        );

        return to_route('auth.otp.show', ['challenge' => $challenge])
            ->with('status', __('We sent a verification code to :email.', ['email' => $challenge->email]));
    }
}
```

Create `app/Http/Controllers/Auth/EmailOtpChallengeController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Http\Controllers\Controller;
use App\Models\EmailOtpChallenge;
use App\Services\Auth\EmailOtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class EmailOtpChallengeController extends Controller
{
    public function show(EmailOtpChallenge $challenge): Response
    {
        abort_unless($challenge->canAttempt(), 403);

        return Inertia::render('auth/verify-otp', [
            'email' => $challenge->email,
            'verifyUrl' => route('auth.otp.verify', ['challenge' => $challenge], absolute: false),
            'resendUrl' => route('auth.otp.resend', ['challenge' => $challenge], absolute: false),
            'status' => session('status'),
        ]);
    }

    public function verify(EmailOtpChallenge $challenge, Request $request, EmailOtpService $otp, SocialUserResolver $resolver): RedirectResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'digits:6'],
        ]);

        if (! $otp->verify($challenge, $challenge->purpose, $validated['code'])) {
            return back()->withErrors(['code' => __('The verification code is invalid or expired.')]);
        }

        if ($challenge->purpose === EmailOtpChallenge::PurposeSocialLogin) {
            $user = $resolver->completeVerifiedEmail(
                ProviderProfile::fromPayload($challenge->payload),
                $challenge->email,
            );

            Auth::login($user, remember: true);
            $request->session()->forget('social_auth.pending_profile');
            $request->session()->regenerate();

            return redirect()->intended(route('dashboard', absolute: false));
        }

        $request->session()->put('auth.email_otp_confirmed_at', time());

        return redirect()->intended(route('profile.edit', absolute: false));
    }

    public function resend(EmailOtpChallenge $challenge, EmailOtpService $otp): RedirectResponse
    {
        $newChallenge = $otp->createAndSend($challenge->email, $challenge->purpose, $challenge->payload ?? []);

        return to_route('auth.otp.show', ['challenge' => $newChallenge])
            ->with('status', __('We sent a new verification code.'));
    }
}
```

- [ ] **Step 6: Wire routes**

Replace the OTP closure from Task 3 in `routes/web.php` and add social routes:

```php
use App\Http\Controllers\Auth\EmailOtpChallengeController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\SocialEmailController;

Route::middleware('guest')->group(function () {
    Route::get('auth/{provider}/redirect', [SocialAuthController::class, 'redirect'])
        ->whereIn('provider', ['google', 'orcid'])
        ->name('auth.social.redirect');

    Route::get('auth/{provider}/callback', [SocialAuthController::class, 'callback'])
        ->whereIn('provider', ['google', 'orcid'])
        ->name('auth.social.callback');

    Route::get('auth/social/email', [SocialEmailController::class, 'create'])
        ->name('auth.social.email.create');

    Route::post('auth/social/email', [SocialEmailController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('auth.social.email.store');
});

Route::get('verify/{challenge}', [EmailOtpChallengeController::class, 'show'])
    ->middleware('signed')
    ->name('auth.otp.show');

Route::post('verify/{challenge}', [EmailOtpChallengeController::class, 'verify'])
    ->middleware('throttle:10,1')
    ->name('auth.otp.verify');

Route::post('verify/{challenge}/resend', [EmailOtpChallengeController::class, 'resend'])
    ->middleware('throttle:3,1')
    ->name('auth.otp.resend');
```

- [ ] **Step 7: Run and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=SocialAuth
php artisan test --compact --filter=EmailOtpChallenge
```

Expected: PASS.

Commit:

```bash
git add app/Http/Controllers/Auth app/Services/Auth/OrcidOAuthClient.php routes/web.php tests/Feature/Auth/SocialAuthTest.php tests/Feature/Auth/EmailOtpChallengeTest.php
git commit -m "feat: add social auth routes"
```

---

### Task 6: Inertia Shared Props And Auth Pages

**Files:**
- Create: `resources/js/pages/auth/social-email.tsx`
- Create: `resources/js/pages/auth/verify-otp.tsx`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Modify: `resources/js/pages/auth/login.tsx`
- Modify: `resources/js/types/auth.ts`
- Modify: `tests/Feature/FortifyFeatureRoutesTest.php`

- [ ] **Step 1: Write failing Inertia route prop tests**

Extend `tests/Feature/FortifyFeatureRoutesTest.php`:

```php
<?php

use App\Support\AuthFeatures;
use Inertia\Testing\AssertableInertia as Assert;

test('disabled optional fortify features share null frontend routes', function () {
    config(['fortify.features' => []]);

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.canRegister', false)
            ->where('auth.canResetPassword', false)
            ->where('auth.canUsePasskeys', false)
            ->where('auth.routes.register', null)
            ->where('auth.routes.passwordRequest', null)
            ->where('auth.routes.passkeyLogin', null)
            ->where('auth.routes.social.google', null)
            ->where('auth.routes.social.orcid', null),
        );
});

test('enabled social providers share frontend routes', function () {
    config(['fortify.features' => [
        AuthFeatures::google(),
        AuthFeatures::orcid(),
    ]]);

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.routes.social.google', route('auth.social.redirect', ['provider' => 'google'], false))
            ->where('auth.routes.social.orcid', route('auth.social.redirect', ['provider' => 'orcid'], false)),
        );
});
```

- [ ] **Step 2: Run prop tests and verify they fail**

Run:

```bash
php artisan test --compact --filter=FortifyFeatureRoutes
```

Expected: FAIL because social route props are missing.

- [ ] **Step 3: Update shared auth props**

Modify `app/Http/Middleware/HandleInertiaRequests.php` imports:

```php
use App\Support\AuthFeatures;
```

Update PHPDoc return shape in `authRoutes()` to include:

```php
 *     social: array{google: string|null, orcid: string|null}
```

Update `authRoutes()` return:

```php
'social' => [
    'google' => AuthFeatures::enabled(AuthFeatures::google())
        ? route('auth.social.redirect', ['provider' => 'google'], absolute: false)
        : null,
    'orcid' => AuthFeatures::enabled(AuthFeatures::orcid())
        ? route('auth.social.redirect', ['provider' => 'orcid'], absolute: false)
        : null,
],
```

- [ ] **Step 4: Update frontend auth types**

Modify `resources/js/types/auth.ts`:

```ts
export type SocialAuthRoutes = {
    google: string | null;
    orcid: string | null;
};
```

Update `Auth.routes`:

```ts
routes: {
    register: string | null;
    passwordRequest: string | null;
    passkeyLogin: PasskeyRoutePair | null;
    social: SocialAuthRoutes;
};
```

- [ ] **Step 5: Replace login page with provider-first UI**

Modify `resources/js/pages/auth/login.tsx` so provider buttons render first and the password form renders only when internal auth routes are present. Use plain anchors for provider redirects:

```tsx
const socialRoutes = auth.routes.social;
const hasSocialRoutes = Boolean(socialRoutes.google || socialRoutes.orcid);
const hasInternalLogin = Boolean(auth.routes.passwordRequest || auth.routes.register);
```

Render provider actions:

```tsx
{hasSocialRoutes && (
    <div className="grid gap-3">
        {socialRoutes.google && (
            <Button asChild variant="outline" className="w-full">
                <a href={socialRoutes.google}>Continue with Google</a>
            </Button>
        )}

        {socialRoutes.orcid && (
            <Button asChild variant="outline" className="w-full">
                <a href={socialRoutes.orcid}>Continue with ORCID</a>
            </Button>
        )}
    </div>
)}
```

Wrap the current password `<Form>` block with:

```tsx
{hasInternalLogin && (
    <Form
        {...store.form()}
        resetOnSuccess={['password']}
        className="flex flex-col gap-6"
    >
        {({ processing, errors }) => (
            // Keep the existing form body.
        )}
    </Form>
)}
```

Update layout text:

```tsx
Login.layout = {
    title: 'Log in to your account',
    description: 'Choose an available sign-in method',
};
```

- [ ] **Step 6: Add social email and OTP pages**

Create `resources/js/pages/auth/social-email.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
    email?: string | null;
    submitUrl: string;
};

export default function SocialEmail({ email, submitUrl }: Props) {
    return (
        <>
            <Head title="Verify email" />

            <Form action={submitUrl} method="post" className="flex flex-col gap-6">
                {({ errors, processing }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoFocus
                                defaultValue={email ?? ''}
                                autoComplete="email"
                                placeholder="email@example.com"
                            />
                            <InputError message={errors.email} />
                        </div>

                        <Button disabled={processing}>Send verification code</Button>
                    </>
                )}
            </Form>
        </>
    );
}

SocialEmail.layout = {
    title: 'Verify your email',
    description: 'Enter the email address to use for this account',
};
```

Create `resources/js/pages/auth/verify-otp.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
    email: string;
    verifyUrl: string;
    resendUrl: string;
    status?: string;
};

export default function VerifyOtp({ email, verifyUrl, resendUrl, status }: Props) {
    return (
        <>
            <Head title="Verification code" />

            {status && <p className="text-sm text-muted-foreground">{status}</p>}

            <Form action={verifyUrl} method="post" className="flex flex-col gap-6">
                {({ errors, processing }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="code">Code sent to {email}</Label>
                            <Input
                                id="code"
                                name="code"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                minLength={6}
                                required
                                autoFocus
                                placeholder="123456"
                            />
                            <InputError message={errors.code} />
                        </div>

                        <Button disabled={processing}>Verify</Button>
                    </>
                )}
            </Form>

            <Form action={resendUrl} method="post" className="mt-4">
                {({ processing }) => (
                    <Button variant="ghost" disabled={processing}>
                        Send a new code
                    </Button>
                )}
            </Form>
        </>
    );
}

VerifyOtp.layout = {
    title: 'Enter verification code',
    description: 'Use the code from your email to continue',
};
```

- [ ] **Step 7: Run frontend/backend checks and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=FortifyFeatureRoutes
bunx tsc --noEmit
```

Expected: tests PASS and TypeScript check PASS.

Commit:

```bash
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/types/auth.ts resources/js/pages/auth/login.tsx resources/js/pages/auth/social-email.tsx resources/js/pages/auth/verify-otp.tsx tests/Feature/FortifyFeatureRoutesTest.php
git commit -m "feat: add social auth frontend"
```

---

### Task 7: Sensitive Confirmation For Social-Only Users

**Files:**
- Create: `app/Http/Controllers/Settings/SensitiveConfirmationController.php`
- Create: `tests/Feature/Settings/SensitiveConfirmationTest.php`
- Modify: `routes/settings.php`
- Modify: `app/Http/Controllers/Settings/SecurityController.php`
- Modify: `app/Http/Requests/Settings/ProfileDeleteRequest.php`
- Modify: `resources/js/pages/settings/security.tsx`
- Modify: `resources/js/components/delete-user.tsx`
- Modify: `resources/js/pages/settings/profile.tsx`

- [ ] **Step 1: Generate controller and test**

Run:

```bash
php artisan make:controller Settings/SensitiveConfirmationController --no-interaction
php artisan make:test --pest SensitiveConfirmationTest --no-interaction
```

Expected: Laravel creates the controller and feature test.

- [ ] **Step 2: Write failing sensitive confirmation tests**

Replace `tests/Feature/Settings/SensitiveConfirmationTest.php`:

```php
<?php

use App\Models\EmailOtpChallenge;
use App\Models\User;
use App\Services\Auth\EmailOtpService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

test('social only user can request sensitive confirmation otp', function () {
    Notification::fake();
    $user = User::factory()->socialOnly()->create(['email' => 'social@example.org']);

    $this->actingAs($user)
        ->post(route('settings.sensitive-confirmation.send'))
        ->assertRedirect();

    $this->assertDatabaseHas('email_otp_challenges', [
        'email' => 'social@example.org',
        'purpose' => EmailOtpChallenge::PurposeSensitiveConfirmation,
    ]);
});

test('social only user can delete account after otp confirmation', function () {
    $user = User::factory()->socialOnly()->create(['email' => 'social@example.org']);
    $challenge = EmailOtpChallenge::factory()->create([
        'email' => 'social@example.org',
        'purpose' => EmailOtpChallenge::PurposeSensitiveConfirmation,
        'code_hash' => Hash::make('123456'),
    ]);

    $this->actingAs($user)
        ->post(route('auth.otp.verify', ['challenge' => $challenge]), ['code' => '123456'])
        ->assertRedirect();

    $this->actingAs($user)
        ->withSession(['auth.email_otp_confirmed_at' => time()])
        ->delete(route('profile.destroy'))
        ->assertRedirect(route('home'));

    expect($user->fresh())->toBeNull();
});

test('password user still needs password to delete account', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'wrong-password'])
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
php artisan test --compact --filter=SensitiveConfirmation
```

Expected: FAIL because confirmation routes/request logic are missing.

- [ ] **Step 4: Implement confirmation controller and routes**

Create `app/Http/Controllers/Settings/SensitiveConfirmationController.php`:

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\EmailOtpChallenge;
use App\Services\Auth\EmailOtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SensitiveConfirmationController extends Controller
{
    public function send(Request $request, EmailOtpService $otp): RedirectResponse
    {
        abort_if($request->user()->hasLocalPassword(), 404);

        $challenge = $otp->createAndSend(
            email: $request->user()->email,
            purpose: EmailOtpChallenge::PurposeSensitiveConfirmation,
            payload: ['user_id' => $request->user()->id],
        );

        return to_route('auth.otp.show', ['challenge' => $challenge])
            ->with('status', __('We sent a confirmation code to your email.'));
    }
}
```

Modify `routes/settings.php` inside the authenticated group:

```php
use App\Http\Controllers\Settings\SensitiveConfirmationController;

Route::post('settings/sensitive-confirmation', [SensitiveConfirmationController::class, 'send'])
    ->middleware('throttle:3,1')
    ->name('settings.sensitive-confirmation.send');
```

- [ ] **Step 5: Update delete request**

Modify `app/Http/Requests/Settings/ProfileDeleteRequest.php`:

```php
public function rules(): array
{
    if (! $this->user()->hasLocalPassword()) {
        return [];
    }

    return [
        'password' => $this->currentPasswordRules(),
    ];
}

public function withValidator($validator): void
{
    $validator->after(function ($validator): void {
        if ($this->user()->hasLocalPassword()) {
            return;
        }

        $confirmedAt = (int) $this->session()->get('auth.email_otp_confirmed_at', 0);

        if ($confirmedAt < now()->subMinutes(10)->timestamp) {
            $validator->errors()->add('otp', __('Please confirm this action with an email code.'));
        }
    });
}
```

Modify `app/Http/Controllers/Settings/ProfileController.php` in `destroy()` before session invalidation:

```php
$request->session()->forget('auth.email_otp_confirmed_at');
```

- [ ] **Step 6: Update settings props and UI**

Modify `app/Http/Controllers/Settings/SecurityController.php` props:

```php
'canUpdatePassword' => $request->user()->hasLocalPassword() || Features::enabled(Features::updatePasswords()),
'sensitiveConfirmationUrl' => $request->user()->hasLocalPassword()
    ? null
    : route('settings.sensitive-confirmation.send', absolute: false),
```

Modify `resources/js/pages/settings/security.tsx` props:

```ts
type Props = {
    passwordRules: string;
    canUpdatePassword: boolean;
    sensitiveConfirmationUrl: string | null;
} & ManagePasskeysProps;
```

Wrap the password form in:

```tsx
{props.canUpdatePassword && (
    <div className="space-y-6">
        {/* existing update password form */}
    </div>
)}
```

Modify `resources/js/components/delete-user.tsx` props:

```tsx
type Props = {
    usesPasswordConfirmation: boolean;
    sensitiveConfirmationUrl: string | null;
};

export default function DeleteUser({ usesPasswordConfirmation, sensitiveConfirmationUrl }: Props) {
```

Render an OTP request form before destructive submit when `usesPasswordConfirmation` is false:

```tsx
{!usesPasswordConfirmation && sensitiveConfirmationUrl && (
    <Form action={sensitiveConfirmationUrl} method="post">
        {({ processing }) => (
            <Button variant="secondary" disabled={processing}>
                Send confirmation code
            </Button>
        )}
    </Form>
)}
```

Modify `resources/js/pages/settings/profile.tsx` to pass:

```tsx
<DeleteUser
    usesPasswordConfirmation={Boolean(auth.user.password)}
    sensitiveConfirmationUrl={auth.routes.sensitiveConfirmation}
/>
```

Also expose `has_local_password` on the shared user payload in `HandleInertiaRequests` or append it on the `User` model. Prefer shared transformation in middleware:

```php
'user' => $request->user() ? [
    ...$request->user()->toArray(),
    'has_local_password' => $request->user()->hasLocalPassword(),
] : null,
```

Update `resources/js/types/auth.ts` `User`:

```ts
has_local_password: boolean;
```

Add `sensitiveConfirmation` to `Auth.routes`:

```ts
sensitiveConfirmation: string | null;
```

- [ ] **Step 7: Run and commit**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact --filter=SensitiveConfirmation
bunx tsc --noEmit
```

Expected: PASS.

Commit:

```bash
git add app/Http/Controllers/Settings/SensitiveConfirmationController.php app/Http/Controllers/Settings/SecurityController.php app/Http/Controllers/Settings/ProfileController.php app/Http/Requests/Settings/ProfileDeleteRequest.php app/Http/Middleware/HandleInertiaRequests.php routes/settings.php resources/js/pages/settings/security.tsx resources/js/pages/settings/profile.tsx resources/js/components/delete-user.tsx resources/js/types/auth.ts tests/Feature/Settings/SensitiveConfirmationTest.php
git commit -m "feat: add otp sensitive confirmation"
```

---

### Task 8: Existing Tests, Formatting, And Full Verification

**Files:**
- Modify: `tests/Feature/Auth/AuthenticationTest.php`
- Modify: `tests/Feature/Auth/PasswordResetTest.php`
- Modify: `tests/Feature/Auth/RegistrationTest.php`
- Modify: `tests/Feature/Settings/ProfileUpdateTest.php`
- Modify: `tests/Feature/Settings/SecurityTest.php`

- [ ] **Step 1: Update auth tests for feature-gated internal auth**

In `tests/Feature/Auth/AuthenticationTest.php`, wrap password login tests with internal auth assumptions. Keep `login screen can be rendered` and `users can logout` always active.

Add before each password-form-specific test:

```php
config(['fortify.features' => [
    Laravel\Fortify\Features::registration(),
    Laravel\Fortify\Features::resetPasswords(),
]]);
```

For tests that post to `login.store`, assert the route exists before posting:

```php
expect(Route::has('login.store'))->toBeTrue();
```

In `tests/Feature/Auth/RegistrationTest.php`, keep the existing `skipUnlessFortifyHas(Features::registration())` gate.

In `tests/Feature/Auth/PasswordResetTest.php`, keep the existing `skipUnlessFortifyHas(Features::resetPasswords())` gate and make sure no assertion runs before the gate.

- [ ] **Step 2: Update settings tests for social-only users**

In `tests/Feature/Settings/ProfileUpdateTest.php`, keep password-delete tests for password users and add a focused social-only delete test only if it is not already covered by `SensitiveConfirmationTest`.

In `tests/Feature/Settings/SecurityTest.php`, keep password update tests using password users:

```php
$user = User::factory()->create();
```

Add a social-only assertion:

```php
test('security page hides password update for social only user', function () {
    $user = User::factory()->socialOnly()->create();

    $this->actingAs($user)
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canUpdatePassword', false)
        );
});
```

- [ ] **Step 3: Run focused suites**

Run:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Feature/Auth
php artisan test --compact tests/Feature/Settings
php artisan test --compact tests/Unit/Auth
bunx tsc --noEmit
```

Expected: all commands PASS.

- [ ] **Step 4: Run full project verification**

Run:

```bash
php artisan test --compact
bun run lint:check
bun run format:check
bun run types:check
```

Expected: all commands PASS. If `bun run lint:check` or `bun run format:check` reports pre-existing unrelated failures, capture the exact output and do not modify unrelated files.

- [ ] **Step 5: Final commit**

Commit only files changed in this task:

```bash
git add tests/Feature/Auth/AuthenticationTest.php tests/Feature/Auth/PasswordResetTest.php tests/Feature/Auth/RegistrationTest.php tests/Feature/Settings/ProfileUpdateTest.php tests/Feature/Settings/SecurityTest.php
git commit -m "test: update auth feature coverage"
```

---

## Self-Review

Spec coverage:

- Google via SocialiteProviders is covered in Task 1 and Task 5.
- ORCID custom OAuth/OpenID client is covered in Task 5.
- Mandatory unique email and nullable password are covered in Task 2.
- `social_accounts` persistence and automatic linking are covered in Task 2 and Task 4.
- OTP challenge persistence, signed verification URL, and code verification are covered in Task 3 and Task 5.
- Feature-gated provider/internal auth UI is covered in Task 1 and Task 6.
- Sensitive confirmations via email OTP for social-only users are covered in Task 7.
- Existing test updates and full verification are covered in Task 8.

Type consistency:

- Provider identifiers are `google` and `orcid`.
- Feature strings are returned by `AuthFeatures`.
- OTP purposes are `EmailOtpChallenge::PurposeSocialLogin` and `EmailOtpChallenge::PurposeSensitiveConfirmation`.
- Shared frontend route keys are `auth.routes.social.google`, `auth.routes.social.orcid`, and `auth.routes.sensitiveConfirmation`.

Implementation caution:

- `composer require socialiteproviders/google` is a dependency change and should only be executed when dependency changes are allowed for the implementation run.
- `ProfileDeleteRequest::withValidator()` is acceptable for this plan because it depends on session state and user password state; keep the logic small and covered by feature tests.
- If Laravel 13 app provider registration differs from `bootstrap/providers.php`, use the provider registration file present in this app and keep the test command unchanged.
