<?php

use App\Mail\SmtpTestMail;
use Illuminate\Contracts\Mail\Factory as MailFactory;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;

use function Pest\Laravel\mock;

test('smtp test rejects an invalid recipient email address', function () {
    Mail::fake();

    $this->artisan('mail:test-smtp', [
        'recipient' => 'invalid-email',
    ])
        ->expectsOutput('The recipient email address is not valid.')
        ->assertFailed();

    Mail::assertNothingOutgoing();
});

test('smtp test sends a message through the smtp mailer', function () {
    Mail::fake();

    $this->artisan('mail:test-smtp', [
        'recipient' => 'operations@example.com',
    ])
        ->expectsOutput('SMTP test email sent to operations@example.com.')
        ->assertSuccessful();

    Mail::assertSent(SmtpTestMail::class, function (SmtpTestMail $mail): bool {
        return $mail->hasTo('operations@example.com')
            && $mail->usesMailer('smtp');
    });
});

test('smtp test reports transport failures', function () {
    $mailer = mock(Mailer::class);
    $pendingMail = (new PendingMail($mailer))->to('operations@example.com');

    $mailer->shouldReceive('to')
        ->once()
        ->with('operations@example.com')
        ->andReturn($pendingMail);
    $mailer->shouldReceive('send')
        ->once()
        ->with(Mockery::on(fn (mixed $mail): bool => $mail instanceof SmtpTestMail
            && $mail->hasTo('operations@example.com')))
        ->andThrow(new TransportException('Connection refused.'));

    $mailFactory = mock(MailFactory::class);
    $mailFactory->shouldReceive('mailer')
        ->once()
        ->with('smtp')
        ->andReturn($mailer);

    $this->artisan('mail:test-smtp', [
        'recipient' => 'operations@example.com',
    ])
        ->expectsOutput('SMTP test failed: Connection refused.')
        ->assertFailed();
});

test('smtp test message identifies the application and its purpose', function () {
    config(['app.name' => 'PyGeoAPI Proxy']);

    $mail = new SmtpTestMail;

    expect($mail->envelope()->subject)->toBe('PyGeoAPI Proxy SMTP test');

    $mail->assertSeeInHtml('The SMTP configuration for PyGeoAPI Proxy is working correctly.');
});
