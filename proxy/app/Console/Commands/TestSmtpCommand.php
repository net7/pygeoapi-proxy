<?php

namespace App\Console\Commands;

use App\Mail\SmtpTestMail;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Contracts\Mail\Factory as MailFactory;
use Throwable;

#[Signature('mail:test-smtp {recipient : Email address that will receive the test message}')]
#[Description('Send a test email using the configured SMTP mailer')]
class TestSmtpCommand extends Command
{
    public function handle(MailFactory $mail): int
    {
        $recipient = trim((string) $this->argument('recipient'));

        if (filter_var($recipient, FILTER_VALIDATE_EMAIL) === false) {
            $this->error('The recipient email address is not valid.');

            return self::FAILURE;
        }

        try {
            $mail->mailer('smtp')
                ->to($recipient)
                ->send(new SmtpTestMail);
        } catch (Throwable $exception) {
            $this->error('SMTP test failed: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info("SMTP test email sent to {$recipient}.");

        return self::SUCCESS;
    }
}
