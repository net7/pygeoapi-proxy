<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\EmailOtpVerifyRequest;
use App\Http\Responses\DeactivatedAccountResponse;
use App\Models\EmailOtpChallenge;
use App\Services\Auth\EmailOtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class EmailOtpChallengeController extends Controller
{
    public function __construct(private DeactivatedAccountResponse $deactivatedAccountResponse) {}

    public function show(EmailOtpChallenge $challenge): Response
    {
        abort_unless($challenge->canAttempt(), 403);

        return Inertia::render('auth/verify-otp', [
            'email' => $challenge->email,
            'status' => session('status'),
            'verifyUrl' => route('auth.otp.verify', ['challenge' => $challenge], absolute: false),
            'resendUrl' => route('auth.otp.resend', ['challenge' => $challenge], absolute: false),
        ]);
    }

    public function verify(
        EmailOtpVerifyRequest $request,
        EmailOtpChallenge $challenge,
        EmailOtpService $otp,
        SocialUserResolver $resolver,
    ): RedirectResponse {
        if (! $otp->verify($challenge, $challenge->purpose, $request->validated('code'))) {
            return back()->withErrors(['code' => __('The verification code is invalid or expired.')]);
        }

        if ($challenge->purpose === EmailOtpChallenge::PurposeSocialLogin) {
            return $this->completeSocialLogin($request, $challenge, $resolver);
        }

        $request->session()->put('auth.email_otp_confirmed_at', now()->timestamp);

        return redirect()->intended(route('profile.edit', absolute: false));
    }

    public function resend(EmailOtpChallenge $challenge, EmailOtpService $otp): RedirectResponse
    {
        abort_unless(! $challenge->isConsumed(), 403);

        $otp->createAndSend($challenge->email, $challenge->purpose, $challenge->payload ?? []);

        return back()->with('status', __('We sent a new verification code.'));
    }

    private function completeSocialLogin(
        EmailOtpVerifyRequest $request,
        EmailOtpChallenge $challenge,
        SocialUserResolver $resolver,
    ): RedirectResponse {
        $payload = $challenge->payload;

        abort_unless(is_array($payload), 422);

        $user = $resolver->completeVerifiedEmail(
            ProviderProfile::fromPayload($payload),
            $challenge->email,
        );

        if ($user->isDeactivated()) {
            session()->forget('social_auth.pending_profile');

            return $this->deactivatedAccountResponse->redirect($request);
        }

        Auth::login($user, remember: true);
        session()->forget('social_auth.pending_profile');
        session()->regenerate();

        return redirect()->intended(route('jobs.index', absolute: false));
    }
}
