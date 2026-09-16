<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FirstAccessController extends Controller
{
    public function __invoke(Request $request): Response
    {
        User::query()
            ->whereKey($request->user()->getAuthIdentifier())
            ->whereNull('first_access_completed_at')
            ->update(['first_access_completed_at' => now()]);

        return response()->noContent();
    }
}
