<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SocialEmailRequest;
use App\Models\EmailOtpChallenge;
use App\Services\Auth\EmailOtpService;
use App\Support\AuthFeatures;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SocialEmailController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        if (! AuthFeatures::enabled(AuthFeatures::emailOtp())) {
            return to_route('login')->withErrors(['email' => __('Email verification is not available.')]);
        }

        $pendingProfile = $request->session()->get('social_auth.pending_profile');

        if (! is_array($pendingProfile)) {
            return to_route('login');
        }

        return Inertia::render('auth/social-email', [
            'email' => $request->old('email', $pendingProfile['email'] ?? ''),
            'status' => $request->session()->get('status'),
            'submitUrl' => route('auth.social.email.store', absolute: false),
        ]);
    }

    public function store(SocialEmailRequest $request, EmailOtpService $otp): RedirectResponse
    {
        if (! AuthFeatures::enabled(AuthFeatures::emailOtp())) {
            return to_route('login')->withErrors(['email' => __('Email verification is not available.')]);
        }

        $pendingProfile = $request->session()->get('social_auth.pending_profile');

        if (! is_array($pendingProfile)) {
            return to_route('login');
        }

        $challenge = $otp->createAndSend(
            email: $request->validated('email'),
            purpose: EmailOtpChallenge::PurposeSocialLogin,
            payload: $pendingProfile,
        );

        return back()->with('status', __('We sent a verification code to :email.', [
            'email' => $challenge->email,
        ]));
    }
}
