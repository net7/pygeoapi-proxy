<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Http\Controllers\Controller;
use App\Services\Auth\OrcidOAuthClient;
use App\Support\AuthFeatures;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;
use Symfony\Component\HttpFoundation\Response;

class SocialAuthController extends Controller
{
    public function redirect(string $provider, Request $request, SocialiteFactory $socialite, OrcidOAuthClient $orcid): Response
    {
        if (! AuthFeatures::providerEnabled($provider)) {
            return to_route('login')->withErrors(['provider' => __('This sign-in provider is not available.')]);
        }

        if ($provider === 'orcid') {
            return $this->externalRedirect($request, $orcid->redirect());
        }

        return $this->externalRedirect($request, $socialite->driver($provider)->redirect());
    }

    public function callback(
        string $provider,
        Request $request,
        SocialiteFactory $socialite,
        OrcidOAuthClient $orcid,
        SocialUserResolver $resolver,
    ): RedirectResponse {
        if (! AuthFeatures::providerEnabled($provider)) {
            return to_route('login')->withErrors(['provider' => __('This sign-in provider is not available.')]);
        }

        $profile = $provider === 'orcid'
            ? $orcid->user((string) $request->query('code'), (string) $request->query('state'))
            : $this->googleProfile($socialite);

        $result = $resolver->resolve($profile);

        if ($result->status === SocialLoginResult::NeedsEmail) {
            $request->session()->put('social_auth.pending_profile', $result->pendingProfile);

            return to_route('auth.social.email.create');
        }

        Auth::login($result->user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    private function googleProfile(SocialiteFactory $socialite): ProviderProfile
    {
        $user = $socialite->driver('google')->user();
        $raw = $user->user;

        return new ProviderProfile(
            provider: 'google',
            providerUserId: (string) $user->getId(),
            name: $user->getName(),
            email: $user->getEmail(),
            emailVerified: (bool) ($raw['email_verified'] ?? false),
            avatar: $user->getAvatar(),
            raw: $raw,
        );
    }

    private function externalRedirect(Request $request, RedirectResponse $redirect): Response
    {
        if ($request->header('X-Inertia')) {
            return Inertia::location($redirect);
        }

        return $redirect;
    }
}
