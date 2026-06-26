<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureActions();
        $this->configureViews();
        $this->configureRateLimiting();
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::createUsersUsing(CreateNewUser::class);

        Fortify::authenticateUsing(function (Request $request): ?User {
            if (! AuthFeatures::enabled(AuthFeatures::passwordLogin())) {
                return null;
            }

            $user = User::query()
                ->where('email', $request->string(Fortify::username())->toString())
                ->first();

            if ($user !== null
                && $user->isActive()
                && $user->password !== null
                && Hash::check((string) $request->input('password'), $user->password)) {
                return $user;
            }

            return null;
        });
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => Features::enabled(Features::resetPasswords()),
            'status' => $request->session()->get('status'),
        ]));

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
            'passwordUpdateAction' => route('password.update', absolute: false),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'passwordEmailAction' => route('password.email', absolute: false),
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(fn () => Inertia::render('auth/register', [
            'registerAction' => route('register.store', absolute: false),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password', [
            'passkeyConfirmRoutes' => $this->passkeyConfirmRoutes(),
        ]));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('passkeys', function (Request $request) {
            return Limit::perMinute(10)->by(
                ($request->input('credential.id') ?: $request->session()->getId()).'|'.$request->ip(),
            );
        });
    }

    /**
     * @return array{options: string, submit: string}|null
     */
    private function passkeyConfirmRoutes(): ?array
    {
        if (! Features::enabled(Features::passkeys())) {
            return null;
        }

        return [
            'options' => route('passkey.confirm-options', absolute: false),
            'submit' => route('passkey.confirm', absolute: false),
        ];
    }
}
