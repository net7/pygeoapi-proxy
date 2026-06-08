<?php

use App\Models\EmailOtpChallenge;
use App\Notifications\EmailOtpNotification;
use App\Services\Auth\EmailOtpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('service creates challenge and sends on demand notification', function () {
    Notification::fake();

    $challenge = app(EmailOtpService::class)->createAndSend(
        email: 'Researcher@Example.ORG',
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        payload: ['provider' => 'orcid'],
        code: '123456',
    );

    expect($challenge->email)->toBe('researcher@example.org')
        ->and($challenge->purpose)->toBe(EmailOtpChallenge::PurposeSocialLogin)
        ->and($challenge->payload)->toBe(['provider' => 'orcid'])
        ->and(Hash::check('123456', $challenge->code_hash))->toBeTrue();

    Notification::assertSentOnDemand(EmailOtpNotification::class, function (EmailOtpNotification $notification) use ($challenge) {
        return $notification->challenge->is($challenge)
            && $notification->code === '123456'
            && str_contains($notification->signedUrl, '/verify/'.$challenge->uuid);
    });
});

test('service verifies valid code and consumes challenge', function () {
    $challenge = EmailOtpChallenge::factory()->create([
        'purpose' => EmailOtpChallenge::PurposeSocialLogin,
        'code_hash' => Hash::make('654321'),
    ]);

    $verified = app(EmailOtpService::class)->verify(
        challenge: $challenge,
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        code: '654321',
    );

    expect($verified)->toBeTrue()
        ->and($challenge->refresh()->consumed_at)->not->toBeNull();
});

test('service rejects invalid code and increments attempts', function () {
    $challenge = EmailOtpChallenge::factory()->create([
        'code_hash' => Hash::make('654321'),
    ]);

    $verified = app(EmailOtpService::class)->verify(
        challenge: $challenge,
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        code: '000000',
    );

    expect($verified)->toBeFalse()
        ->and($challenge->refresh()->attempts)->toBe(1)
        ->and($challenge->consumed_at)->toBeNull();
});

test('notification contains temporary signed url', function () {
    $challenge = EmailOtpChallenge::factory()->create();
    $signedUrl = URL::temporarySignedRoute('auth.otp.show', now()->addMinutes(10), ['challenge' => $challenge]);

    expect(URL::hasValidSignature(request()->create($signedUrl)))->toBeTrue();
});
