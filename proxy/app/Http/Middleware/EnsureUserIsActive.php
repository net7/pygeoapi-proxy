<?php

namespace App\Http\Middleware;

use App\Http\Responses\DeactivatedAccountResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function __construct(private DeactivatedAccountResponse $deactivatedAccountResponse) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->isDeactivated()) {
            return $this->deactivatedAccountResponse->redirect($request);
        }

        return $next($request);
    }
}
