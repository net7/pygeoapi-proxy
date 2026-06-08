<?php

namespace App\Http\Middleware\Settings;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Symfony\Component\HttpFoundation\Response;

class RequireSensitiveConfirmation
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->hasLocalPassword()) {
            if ($this->passwordConfirmationExpired($request)) {
                return redirect()->guest(route('password.confirm'));
            }

            return $next($request);
        }

        if ($this->emailConfirmationExpired($request)) {
            return to_route('profile.edit')
                ->withErrors(['otp' => __('Please confirm this action with an email code.')]);
        }

        return $next($request);
    }

    private function passwordConfirmationExpired(Request $request): bool
    {
        $confirmedAt = Date::now()->unix() - (int) $request->session()->get('auth.password_confirmed_at', 0);

        return $confirmedAt > config('auth.password_timeout', 10800);
    }

    private function emailConfirmationExpired(Request $request): bool
    {
        $confirmedAt = Date::now()->unix() - (int) $request->session()->get('auth.email_otp_confirmed_at', 0);

        return $confirmedAt > 600;
    }
}
