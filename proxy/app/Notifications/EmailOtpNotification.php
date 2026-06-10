<?php

namespace App\Notifications;

use App\Models\EmailOtpChallenge;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailOtpNotification extends Notification implements ShouldQueue
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
            ->subject(__('Confirm your email sign-in'))
            ->greeting(__('Verification required'))
            ->line(__('Use this one-time code to continue: :code', ['code' => $this->code]))
            ->line(__('The code expires in 10 minutes and can only be used once.'))
            ->action(__('Open verification page'), $this->signedUrl)
            ->line(__('If you did not request this code, you can safely ignore this email.'));
    }
}
