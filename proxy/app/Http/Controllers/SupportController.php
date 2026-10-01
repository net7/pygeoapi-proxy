<?php

namespace App\Http\Controllers;

use App\Actions\Support\SubmitSupportEmail;
use App\Http\Requests\StoreSupportRequest;
use App\Support\SupportClientContext;
use Illuminate\Http\RedirectResponse;

class SupportController extends Controller
{
    public function store(StoreSupportRequest $request, SubmitSupportEmail $submit): RedirectResponse
    {
        $validated = $request->validated();
        $submit->handle(
            $validated,
            $request->user(),
            SupportClientContext::collect($request, $validated['technical_context'] ?? []),
        );

        return back();
    }
}
