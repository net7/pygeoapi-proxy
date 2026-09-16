<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Models\EmailOtpChallenge;
use App\Models\User;
use App\Notifications\EmailOtpNotification;
use App\Support\AuthFeatures;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
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
    ])->assertRedirect(route('jobs.index', absolute: false));

    $this->assertAuthenticatedAs($user);
});

test('otp resend opens a verification page that accepts the new code', function (int $elapsedMinutes) {
    $this->freezeTime();
    Notification::fake();

    $user = User::factory()->socialOnly()->create();
    $challenge = EmailOtpChallenge::factory()->create([
        'email' => $user->email,
        'payload' => [
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
            'name' => $user->name,
            'email' => null,
            'email_verified' => false,
            'avatar' => null,
            'raw' => [],
        ],
    ]);
    $originalUrl = URL::temporarySignedRoute('auth.otp.show', $challenge->expires_at, ['challenge' => $challenge]);
    $this->travel($elapsedMinutes)->minutes();

    $response = $this->from($originalUrl)
        ->post(route('auth.otp.resend', ['challenge' => $challenge]));

    Notification::assertSentOnDemandTimes(EmailOtpNotification::class, 1);
    $notification = Notification::sent(new AnonymousNotifiable, EmailOtpNotification::class)->sole();
    $response->assertRedirect($notification->signedUrl)
        ->assertSessionHas('status', 'We sent a new verification code.');

    $this->get($notification->signedUrl)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/verify-otp')
            ->where('verifyUrl', route('auth.otp.verify', ['challenge' => $notification->challenge], absolute: false))
            ->where('resendUrl', route('auth.otp.resend', ['challenge' => $notification->challenge], absolute: false))
        );

    $this->post(route('auth.otp.verify', ['challenge' => $notification->challenge]), [
        'code' => $notification->code,
    ])->assertRedirect(route('jobs.index', absolute: false));

    $this->assertAuthenticatedAs($user);
    $this->assertDatabaseHas('social_accounts', [
        'user_id' => $user->id,
        'provider' => 'orcid',
        'provider_user_id' => '0000-0002-1825-0097',
    ]);
})->with([
    'unexpired original code' => 0,
    'expired original code' => 11,
]);

test('otp resend prevents the previous code from authenticating', function () {
    Notification::fake();

    $challenge = EmailOtpChallenge::factory()->create([
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

    $this->post(route('auth.otp.resend', ['challenge' => $challenge]));

    $this->post(route('auth.otp.verify', ['challenge' => $challenge]), [
        'code' => '123456',
    ])->assertSessionHasErrors(['code' => 'The verification code is invalid or expired.']);

    $this->assertGuest();
    $this->assertDatabaseMissing('users', ['email' => $challenge->email]);
    Notification::assertSentOnDemandTimes(EmailOtpNotification::class, 1);
});

test('otp resend cannot be repeated using the previous verification page', function () {
    Notification::fake();

    $challenge = EmailOtpChallenge::factory()->create();

    $this->post(route('auth.otp.resend', ['challenge' => $challenge]));

    $this->post(route('auth.otp.resend', ['challenge' => $challenge]))
        ->assertForbidden();

    $this->assertDatabaseCount('email_otp_challenges', 2);
    Notification::assertSentOnDemandTimes(EmailOtpNotification::class, 1);
});

test('consumed otp challenges cannot be resent', function () {
    Notification::fake();

    $challenge = EmailOtpChallenge::factory()->create(['consumed_at' => now()]);

    $this->post(route('auth.otp.resend', ['challenge' => $challenge]))
        ->assertForbidden();

    $this->assertDatabaseCount('email_otp_challenges', 1);
    Notification::assertNothingSent();
});
