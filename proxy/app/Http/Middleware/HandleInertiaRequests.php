<?php

namespace App\Http\Middleware;

use App\Support\AuthFeatures;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Middleware;
use Laravel\Fortify\Features;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $this->user($request),
                'canRegister' => Features::enabled(Features::registration()),
                'canResetPassword' => Features::enabled(Features::resetPasswords()),
                'canUsePasskeys' => Features::enabled(Features::passkeys()),
                'canUsePasswordLogin' => AuthFeatures::enabled(AuthFeatures::passwordLogin()),
                'routes' => $this->authRoutes($request),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function user(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        return [
            ...$user->toArray(),
            'has_local_password' => $user->hasLocalPassword(),
        ];
    }

    /**
     * @return array{
     *     register: string|null,
     *     passwordRequest: string|null,
     *     passkeyLogin: array{options: string, submit: string}|null,
     *     socialProviders: list<array{provider: string, label: string, redirect: string}>,
     *     sensitiveConfirmation: string|null
     * }
     */
    private function authRoutes(Request $request): array
    {
        return [
            'register' => Features::enabled(Features::registration())
                ? route('register', absolute: false)
                : null,
            'passwordRequest' => Features::enabled(Features::resetPasswords())
                ? route('password.request', absolute: false)
                : null,
            'passkeyLogin' => Features::enabled(Features::passkeys())
                ? [
                    'options' => route('passkey.login-options', absolute: false),
                    'submit' => route('passkey.login', absolute: false),
                ]
                : null,
            'socialProviders' => $this->socialProviderRoutes(),
            'sensitiveConfirmation' => $request->user() !== null && ! $request->user()->hasLocalPassword()
                ? route('settings.sensitive-confirmation.send', absolute: false)
                : null,
        ];
    }

    /**
     * @return list<array{provider: string, label: string, redirect: string}>
     */
    private function socialProviderRoutes(): array
    {
        return array_map(
            fn (string $provider) => [
                'provider' => $provider,
                'label' => match ($provider) {
                    'google' => 'Google',
                    'orcid' => 'ORCID',
                    default => Str::headline($provider),
                },
                'redirect' => route('auth.social.redirect', ['provider' => $provider], absolute: false),
            ],
            AuthFeatures::enabledProviders(),
        );
    }
}
