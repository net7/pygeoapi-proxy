<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\User;
use App\Services\Auth\OrcidOAuthClient;
use App\Support\AuthFeatures;
use Illuminate\Http\RedirectResponse;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery\MockInterface;

test('disabled provider redirects to login with error', function () {
    config(['fortify.features' => []]);

    $this->get(route('auth.social.redirect', ['provider' => 'google']))
        ->assertRedirect(route('login'));
});

test('google redirect uses socialite driver', function () {
    config(['fortify.features' => [AuthFeatures::google()]]);

    $redirect = new RedirectResponse('https://accounts.google.com/o/oauth2/auth');

    $this->mock(SocialiteFactory::class, function (MockInterface $mock) use ($redirect) {
        $driver = Mockery::mock();
        $driver->shouldReceive('redirect')->once()->andReturn($redirect);
        $mock->shouldReceive('driver')->with('google')->once()->andReturn($driver);
    });

    $this->get(route('auth.social.redirect', ['provider' => 'google']))
        ->assertRedirect('https://accounts.google.com/o/oauth2/auth');
});

test('orcid redirect returns inertia location for inertia requests', function () {
    config(['fortify.features' => [AuthFeatures::orcid()]]);

    $redirect = new RedirectResponse('https://orcid.org/oauth/authorize?client_id=orcid-client');
    $manifest = public_path('build/manifest.json');

    $this->mock(OrcidOAuthClient::class, function (MockInterface $mock) use ($redirect) {
        $mock->shouldReceive('redirect')->once()->andReturn($redirect);
    });

    $this
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => file_exists($manifest) ? hash_file('xxh128', $manifest) : '',
        ])
        ->get(route('auth.social.redirect', ['provider' => 'orcid']))
        ->assertConflict()
        ->assertHeader('X-Inertia-Location', 'https://orcid.org/oauth/authorize?client_id=orcid-client');
});

test('google callback logs in resolved user', function () {
    config(['fortify.features' => [AuthFeatures::google()]]);

    $user = User::factory()->create();
    $socialiteUser = (new SocialiteUser)->map([
        'id' => 'google-123',
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.org',
        'avatar' => null,
    ]);
    $socialiteUser->user = ['email_verified' => true];

    $this->mock(SocialiteFactory::class, function (MockInterface $mock) use ($socialiteUser) {
        $driver = Mockery::mock();
        $driver->shouldReceive('user')->once()->andReturn($socialiteUser);
        $mock->shouldReceive('driver')->with('google')->once()->andReturn($driver);
    });

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) use ($user) {
        $mock->shouldReceive('resolve')
            ->once()
            ->with(Mockery::on(fn (ProviderProfile $profile) => $profile->provider === 'google' && $profile->emailVerified === true))
            ->andReturn(SocialLoginResult::authenticated($user));
    });

    $this->get(route('auth.social.callback', ['provider' => 'google']))
        ->assertRedirect(route('jobs.index', absolute: false));

    $this->assertAuthenticatedAs($user);
});

test('callback requiring email stores pending profile', function () {
    config(['fortify.features' => [AuthFeatures::orcid(), AuthFeatures::emailOtp()]]);

    $profile = new ProviderProfile(
        provider: 'orcid',
        providerUserId: '0000-0002-1825-0097',
        name: 'Researcher',
        email: null,
        emailVerified: false,
        avatar: null,
        raw: [],
    );

    $this->mock(OrcidOAuthClient::class, function (MockInterface $mock) use ($profile) {
        $mock->shouldReceive('user')->once()->andReturn($profile);
    });

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) {
        $mock->shouldReceive('resolve')
            ->once()
            ->andReturn(SocialLoginResult::needsEmail([
                'provider' => 'orcid',
                'provider_user_id' => '0000-0002-1825-0097',
                'name' => 'Researcher',
                'email' => null,
                'email_verified' => false,
                'avatar' => null,
                'raw' => [],
            ]));
    });

    $this->get(route('auth.social.callback', ['provider' => 'orcid']))
        ->assertRedirect(route('auth.social.email.create'))
        ->assertSessionHas('social_auth.pending_profile');
});
