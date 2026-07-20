<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\EmailOtpChallenge;
use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Passkeys;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery\MockInterface;

test('deactivated account page can be rendered', function () {
    $this->get('/account/deactivated')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/account-deactivated'));
});

test('deactivated users with valid credentials are redirected to the deactivated account page', function () {
    config(['fortify.features' => [AuthFeatures::passwordLogin()]]);

    $user = User::factory()->deactivated()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    expect($response->headers->get('Location'))->toBe(url('/account/deactivated'));
    $response->assertSessionMissing('errors');

    $this->assertGuest();
});

test('deactivated users with invalid credentials receive the standard login error', function () {
    config(['fortify.features' => [AuthFeatures::passwordLogin()]]);

    $user = User::factory()->deactivated()->create();

    $this->from(route('login'))
        ->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'invalid-password',
        ])->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('deactivated authenticated users are logged out', function () {
    $user = User::factory()->deactivated()->create();

    $response = $this->actingAs($user)->get(route('jobs.index'));

    expect($response->headers->get('Location'))->toBe(url('/account/deactivated'));
    $response->assertSessionMissing('errors');

    $this->assertGuest();
});

test('deactivated users cannot authenticate through a social callback', function () {
    config(['fortify.features' => [AuthFeatures::google()]]);

    $user = User::factory()->deactivated()->create();
    $socialiteUser = (new SocialiteUser)->map([
        'id' => 'google-123',
        'name' => 'Ada Lovelace',
        'email' => $user->email,
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
            ->andReturn(SocialLoginResult::authenticated($user));
    });

    $response = $this->get(route('auth.social.callback', ['provider' => 'google']));

    expect($response->headers->get('Location'))->toBe(url('/account/deactivated'));
    $response->assertSessionMissing('errors');

    $this->assertGuest();
});

test('deactivated users cannot authenticate after social email verification', function () {
    config(['fortify.features' => [AuthFeatures::emailOtp()]]);

    $challenge = EmailOtpChallenge::factory()->create([
        'purpose' => EmailOtpChallenge::PurposeSocialLogin,
        'email' => 'researcher@example.org',
        'code_hash' => Hash::make('123456'),
        'payload' => [
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
            'name' => 'Researcher',
            'email' => null,
            'email_verified' => false,
            'avatar' => null,
            'raw' => [],
        ],
    ]);
    $user = User::factory()->socialOnly()->deactivated()->create(['email' => 'researcher@example.org']);

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) use ($user) {
        $mock->shouldReceive('completeVerifiedEmail')
            ->once()
            ->with(Mockery::type(ProviderProfile::class), 'researcher@example.org')
            ->andReturn($user);
    });

    $response = $this->post(route('auth.otp.verify', ['challenge' => $challenge]), [
        'code' => '123456',
    ]);

    expect($response->headers->get('Location'))->toBe(url('/account/deactivated'));
    $response->assertSessionMissing('errors');

    $this->assertGuest();
});

test('deactivated users with a valid passkey are redirected to the deactivated account page', function () {
    $activeUser = User::factory()->create();
    $activePasskey = new Passkey;
    $activePasskey->setRelation('user', $activeUser);

    $deactivatedUser = User::factory()->deactivated()->create();
    $deactivatedPasskey = new Passkey;
    $deactivatedPasskey->setRelation('user', $deactivatedUser);

    expect(Passkeys::allowsLogin(request(), $activePasskey))->toBeTrue();

    $request = Request::create('/passkeys/login', 'POST', server: [
        'HTTP_ACCEPT' => 'application/json',
    ]);

    try {
        Passkeys::allowsLogin($request, $deactivatedPasskey);
    } catch (HttpResponseException $exception) {
        $response = $exception->getResponse();

        expect($response->getStatusCode())->toBe(200)
            ->and(json_decode((string) $response->getContent(), true))->toBe([
                'redirect' => url('/account/deactivated'),
            ]);

        return;
    }

    $this->fail('The deactivated passkey login was not interrupted.');
});
