<?php

namespace App\Http\Controllers;

use App\Actions\Support\SubmitSupportEmail;
use App\Http\Requests\StoreSupportRequest;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SupportController extends Controller
{
    public function create(Request $request, SupportContactManager $contacts): Response
    {
        return Inertia::render('support/create', [
            'available' => $contacts->current() !== null,
            'initialEmail' => $request->user()?->email ?? '',
        ]);
    }

    public function store(StoreSupportRequest $request, SubmitSupportEmail $submit): RedirectResponse
    {
        $submit->handle($request->validated(), $request->user());
        Inertia::flash('toast', [
            'type' => 'success',
            'title' => __('Request accepted'),
            'message' => __('Request accepted. Replies will be sent to the email address provided.'),
        ]);

        return to_route('support.create');
    }
}
