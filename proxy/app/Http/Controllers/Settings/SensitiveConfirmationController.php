<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\EmailOtpChallenge;
use App\Services\Auth\EmailOtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SensitiveConfirmationController extends Controller
{
    public function send(Request $request, EmailOtpService $otp): RedirectResponse
    {
        abort_if($request->user()->hasLocalPassword(), 404);

        $otp->createAndSend(
            email: $request->user()->email,
            purpose: EmailOtpChallenge::PurposeSensitiveConfirmation,
            payload: ['user_id' => $request->user()->id],
        );

        return back()->with('status', __('We sent a confirmation code to your email.'));
    }
}
