<?php

namespace App\Services\Auth;

use App\Data\ProviderProfile;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;

class OrcidOAuthClient
{
    public function __construct(private HttpFactory $http) {}

    public function redirect(): RedirectResponse
    {
        $state = Str::random(40);
        session(['orcid_oauth_state' => $state]);

        return Redirect::away(config('services.orcid.base_url').'/oauth/authorize?'.http_build_query([
            'client_id' => config('services.orcid.client_id'),
            'response_type' => 'code',
            'scope' => config('services.orcid.scope', 'openid'),
            'redirect_uri' => config('services.orcid.redirect'),
            'state' => $state,
        ]));
    }

    public function user(string $code, string $state): ProviderProfile
    {
        abort_unless(hash_equals((string) session('orcid_oauth_state'), $state), 403);
        session()->forget('orcid_oauth_state');

        $token = $this->http
            ->asForm()
            ->timeout(10)
            ->connectTimeout(3)
            ->post(config('services.orcid.base_url').'/oauth/token', [
                'client_id' => config('services.orcid.client_id'),
                'client_secret' => config('services.orcid.client_secret'),
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => config('services.orcid.redirect'),
            ])
            ->throw()
            ->json();

        $orcid = (string) ($token['orcid'] ?? $token['sub'] ?? '');

        return new ProviderProfile(
            provider: 'orcid',
            providerUserId: $orcid,
            name: $token['name'] ?? null,
            email: null,
            emailVerified: false,
            avatar: $this->avatar($token),
            raw: $token,
        );
    }

    /**
     * @param  array<string, mixed>  $token
     */
    private function avatar(array $token): ?string
    {
        $avatar = $token['picture'] ?? $token['avatar'] ?? null;

        return is_string($avatar) && filled($avatar) ? $avatar : null;
    }
}
