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

test('service rejects a code consumed by another request', function () {
    $challenge = EmailOtpChallenge::factory()->create();
    $challenge->fresh()->consume();

    $verified = app(EmailOtpService::class)->verify(
        challenge: $challenge,
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        code: '123456',
    );

    expect($verified)->toBeFalse();
});

test('service rejects an expired code', function () {
    $this->freezeTime();
    $challenge = EmailOtpChallenge::factory()->create();
    $this->travel(10)->minutes();
    $this->travel(1)->seconds();

    $verified = app(EmailOtpService::class)->verify(
        challenge: $challenge,
        purpose: EmailOtpChallenge::PurposeSocialLogin,
        code: '123456',
    );

    expect($verified)->toBeFalse();
    expect($challenge->refresh()->consumed_at)->toBeNull();
});

test('queued notifications preserve the language selected when requested', function (string $language) {
    Notification::fake();
    app()->setLocale($language);

    app(EmailOtpService::class)->createAndSend(
        email: 'researcher@example.org',
        purpose: EmailOtpChallenge::PurposeSocialLogin,
    );

    app()->setLocale($language === 'it' ? 'en' : 'it');

    Notification::assertSentOnDemand(EmailOtpNotification::class, fn (EmailOtpNotification $notification): bool => $notification->locale === $language);
})->with(['it', 'en']);

test('italian verification emails localize the shared mail template', function () {
    app()->setLocale('it');

    $challenge = EmailOtpChallenge::factory()->create();
    $mail = (new EmailOtpNotification($challenge, '123456', 'https://example.test/verify'))
        ->toMail((object) []);
    $html = (string) $mail->render();

    expect($mail->subject)->toBe('Conferma l’accesso via email')
        ->and($html)->toContain('Apri la pagina di verifica')
        ->toContain('Cordiali saluti,')
        ->toContain('Tutti i diritti riservati.')
        ->toContain('copia e incolla')
        ->not->toContain('Regards,')
        ->not->toContain('If you&#039;re having trouble');
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

test('notification mail is informative', function () {
    $challenge = EmailOtpChallenge::factory()->create();
    $mail = (new EmailOtpNotification($challenge, '123456', 'https://example.test/verify'))
        ->toMail((object) []);

    expect($mail->subject)->toBe('Confirm your email sign-in')
        ->and($mail->greeting)->toBe('Verification required')
        ->and($mail->introLines)->toContain('Use this one-time code to continue: 123456')
        ->and($mail->introLines)->toContain('The code expires in 10 minutes and can only be used once.')
        ->and($mail->actionText)->toBe('Open verification page')
        ->and($mail->outroLines)->toContain('If you did not request this code, you can safely ignore this email.');
});
