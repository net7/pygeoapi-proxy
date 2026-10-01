<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSupportAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() === null && config('support.allow_guests') !== true) {
            throw new AuthenticationException(redirectTo: route('login'));
        }

        return $next($request);
    }
}
