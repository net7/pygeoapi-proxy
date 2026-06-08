<?php

use App\Services\Auth\OrcidOAuthClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

test('orcid profile uses picture claim as avatar when available', function () {
    config([
        'services.orcid.base_url' => 'https://orcid.example',
        'services.orcid.client_id' => 'orcid-client',
        'services.orcid.client_secret' => 'orcid-secret',
        'services.orcid.redirect' => 'https://app.example/auth/orcid/callback',
    ]);
    session(['orcid_oauth_state' => 'known-state']);

    Http::fake([
        'https://orcid.example/oauth/token' => Http::response([
            'orcid' => '0000-0002-1825-0097',
            'name' => 'Researcher',
            'picture' => 'https://example.org/orcid-avatar.png',
        ]),
    ]);

    $profile = app(OrcidOAuthClient::class)->user('auth-code', 'known-state');

    expect($profile->avatar)->toBe('https://example.org/orcid-avatar.png');
});
