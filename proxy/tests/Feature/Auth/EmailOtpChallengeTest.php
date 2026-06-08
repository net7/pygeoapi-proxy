<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Models\EmailOtpChallenge;
use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

test('signed otp verification page renders', function () {
    $challenge = EmailOtpChallenge::factory()->create();

    $url = URL::temporarySignedRoute('auth.otp.show', now()->addMinutes(10), ['challenge' => $challenge]);

    $this->get($url)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/verify-otp')
            ->where('email', $challenge->email)
        );
});

test('otp submission completes pending social login', function () {
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
    $user = User::factory()->socialOnly()->create(['email' => 'researcher@example.org']);

    $this->mock(SocialUserResolver::class, function (MockInterface $mock) use ($user) {
        $mock->shouldReceive('completeVerifiedEmail')
            ->once()
            ->with(Mockery::type(ProviderProfile::class), 'researcher@example.org')
            ->andReturn($user);
    });

    $this->post(route('auth.otp.verify', ['challenge' => $challenge]), [
        'code' => '123456',
    ])->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($user);
});
