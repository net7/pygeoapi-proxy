<?php

namespace App\Http\Controllers;

use App\Actions\Support\SubmitSupportEmail;
use App\Http\Requests\StoreSupportRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class SupportController extends Controller
{
    public function store(StoreSupportRequest $request, SubmitSupportEmail $submit): RedirectResponse
    {
        $submit->handle($request->validated(), $request->user());
        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Request accepted'),
            'message' => __('Request accepted. Replies will be sent to the email address provided.'),
        ]);

        return back();
    }
}
