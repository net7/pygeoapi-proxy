<?php

namespace App\Notifications;

use App\Models\EmailOtpChallenge;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailOtpNotification extends Notification
{
    use Queueable;

    public function __construct(
        public EmailOtpChallenge $challenge,
        public string $code,
        public string $signedUrl,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('Your verification code'))
            ->line(__('Use this code to continue: :code', ['code' => $this->code]))
            ->action(__('Open verification page'), $this->signedUrl)
            ->line(__('This link and code expire shortly. If you did not request this, you can ignore this email.'));
    }
}
