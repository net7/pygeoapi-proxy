<?php

namespace App\Http\Controllers;

use App\Actions\Support\SubmitSupportEmail;
use App\Http\Requests\StoreSupportRequest;
use Illuminate\Http\RedirectResponse;

class SupportController extends Controller
{
    public function store(StoreSupportRequest $request, SubmitSupportEmail $submit): RedirectResponse
    {
        $submit->handle($request->validated(), $request->user());

        return back();
    }
}
