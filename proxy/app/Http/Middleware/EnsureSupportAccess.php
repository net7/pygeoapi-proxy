<?php

namespace App\Http\Middleware;

use App\Services\Support\SupportContactManager;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSupportAccess
{
    public function __construct(private SupportContactManager $contacts) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() === null && config('support.allow_guests') !== true) {
            throw new AuthenticationException(redirectTo: route('login'));
        }

        abort_if(
            $request->user() !== null && $this->contacts->current()?->is($request->user()),
            403,
            __('You are the technical contact and cannot send a support request to yourself.'),
        );

        return $next($request);
    }
}
