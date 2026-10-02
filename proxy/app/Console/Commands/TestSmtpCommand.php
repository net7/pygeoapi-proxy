<?php

namespace App\Console\Commands;

use App\Mail\SmtpTestMail;
use App\Support\SmtpDiagnostics;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Contracts\Mail\Factory as MailFactory;
use Illuminate\Mail\SentMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Prompts\Exceptions\NonInteractiveValidationException;
use RuntimeException;
use Symfony\Component\Console\Formatter\OutputFormatter;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

use function Laravel\Prompts\error;
use function Laravel\Prompts\intro;
use function Laravel\Prompts\note;
use function Laravel\Prompts\outro;
use function Laravel\Prompts\spin;
use function Laravel\Prompts\table;
use function Laravel\Prompts\text;

#[Signature('mail:test-smtp {recipient? : Email address that will receive the test message}')]
#[Description('Send a test email using the configured SMTP mailer')]
class TestSmtpCommand extends Command
{
    public function handle(MailFactory $mail): int
    {
        $recipient = trim((string) $this->argument('recipient'));

        if ($recipient === '') {
            if (! $this->input->isInteractive()) {
                error('Provide a recipient: php artisan mail:test-smtp you@example.com');

                return self::FAILURE;
            }

            try {
                $recipient = trim(text(
                    label: 'Who should receive the test email?',
                    placeholder: 'you@example.com',
                    required: 'A recipient email address is required.',
                    validate: fn (string $value): ?string => filter_var(trim($value), FILTER_VALIDATE_EMAIL) === false
                        ? 'The recipient email address is not valid.'
                        : null,
                    hint: 'A test message will be sent using the configured SMTP mailer.',
                ));
            } catch (NonInteractiveValidationException) {
                error('Provide a recipient: php artisan mail:test-smtp you@example.com');

                return self::FAILURE;
            }
        }

        if (filter_var($recipient, FILTER_VALIDATE_EMAIL) === false) {
            error('The recipient email address is not valid.');

            return self::FAILURE;
        }

        $diagnostics = new SmtpDiagnostics((array) config('mail.mailers.smtp', []));
        $startedAt = hrtime(true);
        $context = [
            'diagnostic_id' => (string) Str::uuid(),
            'mailer' => 'smtp',
            'recipient' => $recipient,
            'from' => config('mail.from.address'),
            'environment' => app()->environment(),
            'configuration_cached' => app()->configurationIsCached(),
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
        ];

        intro('SMTP connection test');
        note('Diagnostic ID: '.$context['diagnostic_id']);

        try {
            $context['configuration'] = $diagnostics->configuration();
            $this->showConfiguration($context['configuration'], $recipient);
            Log::info('SMTP test started.', $context);

            if ($diagnostics->transport() !== 'smtp') {
                throw new RuntimeException('The smtp mailer must use the smtp transport; configured transport: '.$context['configuration']['transport'].'.');
            }

            $sent = spin(
                callback: fn (): ?SentMessage => $mail->mailer('smtp')->to($recipient)->send(new SmtpTestMail),
                message: 'Connecting to the SMTP server and sending the test email...',
            );

            if ($sent === null) {
                throw new RuntimeException('The mailer did not send the test message.');
            }

            $context['duration_ms'] = round((hrtime(true) - $startedAt) / 1_000_000, 2);
            $context['message_id'] = $diagnostics->redact($sent->getMessageId());
            $context['smtp_debug'] = $diagnostics->redact($sent->getDebug());
            Log::info('SMTP test completed.', $context);
            $this->showConversation($context['smtp_debug']);
            note("Message ID: {$context['message_id']} | Duration: {$context['duration_ms']} ms");
            note('The SMTP server accepted the message; inbox delivery is not guaranteed.');
            outro("SMTP test email sent to {$recipient}.");

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $debug = '';

            for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
                if ($cause instanceof TransportExceptionInterface) {
                    $debug .= $cause->getDebug();
                }
            }

            $context['duration_ms'] = round((hrtime(true) - $startedAt) / 1_000_000, 2);
            $context['smtp_debug'] = $diagnostics->redact($debug);
            $context['exceptions'] = $diagnostics->exceptions($exception);
            Log::error('SMTP test failed.', $context);
            error('SMTP test failed: '.OutputFormatter::escape($diagnostics->redact($exception->getMessage())));
            $this->showConversation($context['smtp_debug']);
            note("Duration: {$context['duration_ms']} ms. Full exception details are in the application logs.");

            return self::FAILURE;
        }
    }

    /**
     * @param  array<string, string|int|float|bool>  $configuration
     */
    private function showConfiguration(array $configuration, string $recipient): void
    {
        $rows = [['Recipient', $recipient], ['From', (string) config('mail.from.address')]];

        foreach ($configuration as $key => $value) {
            $rows[] = [Str::headline($key), is_bool($value) ? ($value ? 'yes' : 'no') : (string) $value];
        }

        table(
            headers: ['Setting', 'Value'],
            rows: array_map(fn (array $row): array => array_map(OutputFormatter::escape(...), $row), $rows),
        );
    }

    private function showConversation(string $debug): void
    {
        note('SMTP conversation (> client, < server; authentication credentials redacted)');

        if (trim($debug) === '') {
            note('No SMTP conversation was captured. The connection may have failed before the server greeting.');

            return;
        }

        $this->line(OutputFormatter::escape(trim($debug)));
    }
}
