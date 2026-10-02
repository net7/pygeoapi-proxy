<?php

use App\Mail\SmtpTestMail;
use Illuminate\Contracts\Mail\Factory as MailFactory;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\Transport\Smtp\SmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\AbstractStream;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Process\Process;

use function Pest\Laravel\mock;

function smtpTestTransport(array $responses): SmtpTransport
{
    $stream = new class($responses) extends AbstractStream
    {
        public function __construct(private array $responses) {}

        public function initialize(): void
        {
            $this->in = fopen('php://memory', 'w+');
            $this->out = fopen('php://memory', 'w+');
            fwrite($this->out, implode("\r\n", $this->responses)."\r\n");
            rewind($this->out);
        }

        protected function getReadConnectionDescription(): string
        {
            return 'smtp.example.test';
        }
    };

    return new SmtpTransport($stream);
}

function smtpTestSuccessfulTransport(): SmtpTransport
{
    return smtpTestTransport([
        '220 smtp.example.test ESMTP ready',
        '250 smtp.example.test',
        '250 2.1.0 Sender accepted',
        '250 2.1.5 Recipient accepted',
        '354 Send message',
        '250 2.0.0 Ok: queued as QUEUE123',
        '221 Bye',
    ]);
}

test('smtp test rejects an invalid recipient email address', function () {
    Mail::fake();

    $this->artisan('mail:test-smtp', [
        'recipient' => 'invalid-email',
    ])
        ->expectsPromptsError('The recipient email address is not valid.')
        ->assertFailed();

    Mail::assertNothingOutgoing();
});

test('smtp test sends a message through the smtp mailer', function () {
    Log::spy();
    Mail::mailer('smtp')->setSymfonyTransport(smtpTestSuccessfulTransport());

    $this->artisan('mail:test-smtp', [
        'recipient' => '  operations@example.com  ',
    ])
        ->expectsPromptsOutro('SMTP test email sent to operations@example.com.')
        ->expectsOutputToContain('250 2.0.0 Ok: queued as QUEUE123')
        ->assertSuccessful();

    Log::shouldHaveReceived('info')->with('SMTP test completed.', Mockery::on(
        fn (array $context): bool => $context['recipient'] === 'operations@example.com'
            && $context['mailer'] === 'smtp'
            && $context['message_id'] === 'QUEUE123'
            && $context['duration_ms'] >= 0
            && filled($context['diagnostic_id'])
            && str_contains($context['smtp_debug'], '> RCPT TO:<operations@example.com>')
            && str_contains($context['smtp_debug'], '250 2.0.0 Ok: queued as QUEUE123')
    ))->once();
});

test('smtp test asks for the recipient when omitted', function () {
    Mail::mailer('smtp')->setSymfonyTransport(smtpTestSuccessfulTransport());

    $this->artisan('mail:test-smtp')
        ->expectsQuestion('Who should receive the test email?', '  operations@example.com  ')
        ->expectsPromptsOutro('SMTP test email sent to operations@example.com.')
        ->assertSuccessful();
});

test('smtp test rejects an invalid interactive recipient without attempting delivery', function () {
    Mail::fake();

    $this->artisan('mail:test-smtp')
        ->expectsQuestion('Who should receive the test email?', 'invalid-email')
        ->expectsOutputToContain('The recipient email address is not valid.')
        ->assertFailed();

    Mail::assertNothingOutgoing();
});

test('smtp test requires a recipient in non-interactive mode without attempting delivery', function () {
    Mail::fake();

    $this->artisan('mail:test-smtp', ['--no-interaction' => true])
        ->expectsPromptsError('Provide a recipient: php artisan mail:test-smtp you@example.com')
        ->assertFailed();

    Mail::assertNothingOutgoing();
});

test('smtp test reports missing input cleanly when standard input is not a terminal', function () {
    $process = new Process([PHP_BINARY, 'artisan', 'mail:test-smtp', '--no-ansi'], base_path(), ['APP_ENV' => 'local']);

    $process->run();

    expect($process->getExitCode())->toBe(1);
    expect($process->getOutput())
        ->toContain('Provide a recipient: php artisan mail:test-smtp you@example.com')
        ->not->toContain('NonInteractiveValidationException');
});

test('smtp test reports transport failures', function () {
    Log::spy();
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
        ->expectsPromptsError('SMTP test failed: Connection refused.')
        ->expectsOutputToContain('No SMTP conversation was captured')
        ->assertFailed();

    Log::shouldHaveReceived('error')->with('SMTP test failed.', Mockery::on(
        fn (array $context): bool => $context['exceptions'][0]['type'] === TransportException::class
            && $context['exceptions'][0]['message'] === 'Connection refused.'
            && $context['exceptions'][0]['trace'] !== []
            && $context['smtp_debug'] === ''
    ))->once();
});

test('smtp test logs the server rejection and redacts authentication credentials', function () {
    config([
        'mail.mailers.smtp.username' => 'smtp-user',
        'mail.mailers.smtp.password' => 'smtp-password',
    ]);
    Log::spy();
    $exception = new TransportException('Authentication failed for smtp-user: 535 5.7.8 Authentication rejected', 535);
    $exception->appendDebug("< 220 smtp.example.test ESMTP ready\n> AUTH LOGIN\n< 334 VXNlcm5hbWU6\n> c210cC11c2Vy\n< 334 UGFzc3dvcmQ6\n> c210cC1wYXNzd29yZA==\n< 535 5.7.8 Authentication rejected\n");
    $transport = mock(TransportInterface::class);
    $transport->shouldReceive('send')->once()->andThrow($exception);
    Mail::mailer('smtp')->setSymfonyTransport($transport);

    $this->artisan('mail:test-smtp', ['recipient' => 'operations@example.com'])
        ->expectsOutputToContain('535 5.7.8 Authentication rejected')
        ->doesntExpectOutputToContain('smtp-password')
        ->doesntExpectOutputToContain('c210cC1wYXNzd29yZA==')
        ->doesntExpectOutputToContain('smtp-user')
        ->doesntExpectOutputToContain('c210cC11c2Vy')
        ->assertFailed();

    Log::shouldHaveReceived('error')->with('SMTP test failed.', Mockery::on(function (array $context): bool {
        expect($context['smtp_debug'])->toContain('> AUTH LOGIN', '< 535 5.7.8 Authentication rejected', '[REDACTED]');
        expect($context['exceptions'][0]['code'])->toBe(535);
        expect(json_encode($context))->not->toContain('smtp-password', 'c210cC1wYXNzd29yZA==', 'smtp-user', 'c210cC11c2Vy');

        return true;
    }))->once();
});

test('smtp test preserves the conversation when the server rejects the recipient', function () {
    Log::spy();
    Mail::mailer('smtp')->setSymfonyTransport(smtpTestTransport([
        '220 smtp.example.test ESMTP ready',
        '250 smtp.example.test',
        '250 Sender accepted',
        '550 5.1.1 Recipient does not exist',
        '250 Reset',
        '221 Bye',
    ]));

    $this->artisan('mail:test-smtp', ['recipient' => 'operations@example.com'])
        ->expectsOutputToContain('550 5.1.1 Recipient does not exist')
        ->assertFailed();

    Log::shouldHaveReceived('error')->with('SMTP test failed.', Mockery::on(
        fn (array $context): bool => str_contains($context['smtp_debug'], '> RCPT TO:<operations@example.com>')
            && str_contains($context['smtp_debug'], '< 550 5.1.1 Recipient does not exist')
            && $context['exceptions'][0]['code'] === 550
    ))->once();
});

test('smtp test does not report success when sending is cancelled', function () {
    Event::listen(MessageSending::class, fn (): bool => false);
    Mail::mailer('smtp')->setSymfonyTransport(smtpTestSuccessfulTransport());

    $this->artisan('mail:test-smtp', ['recipient' => 'operations@example.com'])
        ->expectsPromptsError('SMTP test failed: The mailer did not send the test message.')
        ->assertFailed();
});

test('smtp test rejects mailers that do not actually use SMTP', function () {
    config(['mail.mailers.smtp' => ['transport' => 'log']]);
    Mail::fake();

    $this->artisan('mail:test-smtp', ['recipient' => 'operations@example.com'])
        ->expectsPromptsError('SMTP test failed: The smtp mailer must use the smtp transport; configured transport: log.')
        ->assertFailed();

    Mail::assertNothingOutgoing();
});

test('smtp test does not treat redacted configuration as the transport configuration', function () {
    config(['mail.mailers.smtp.username' => 'smtp']);
    Mail::mailer('smtp')->setSymfonyTransport(smtpTestSuccessfulTransport());

    $this->artisan('mail:test-smtp', ['recipient' => 'operations@example.com'])
        ->assertSuccessful();
});

test('smtp test message identifies the application and its purpose', function () {
    config(['app.name' => 'PyGeoAPI Proxy']);

    $mail = new SmtpTestMail;

    expect($mail->envelope()->subject)->toBe('PyGeoAPI Proxy SMTP test');

    $mail->assertSeeInHtml('The SMTP configuration for PyGeoAPI Proxy is working correctly.');
});
