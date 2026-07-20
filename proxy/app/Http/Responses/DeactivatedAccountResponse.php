<?php

namespace App\Http\Responses;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DeactivatedAccountResponse
{
    public function redirect(Request $request): RedirectResponse
    {
        $this->logout($request);

        return to_route('account.deactivated');
    }

    public function abort(Request $request): never
    {
        $this->logout($request);

        $response = $request->expectsJson()
            ? response()->json(['redirect' => route('account.deactivated')])
            : to_route('account.deactivated');

        throw new HttpResponseException($response);
    }

    private function logout(Request $request): void
    {
        if ($request->user() === null) {
            return;
        }

        Auth::guard()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
