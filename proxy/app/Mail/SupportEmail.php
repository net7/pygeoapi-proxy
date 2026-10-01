<?php

namespace App\Mail;

use App\Support\SupportMailData;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SupportEmail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public readonly SupportMailData $data) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address((string) config('mail.from.address'), (string) config('mail.from.name')),
            replyTo: [new Address($this->data->replyTo)],
            subject: '[ASSISTENZA] '.$this->data->subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $context = $this->data->technicalContext ?? [];

        return new Content(
            view: 'mail.support-email',
            text: 'mail.support-email-text',
            with: ['technicalDetails' => array_filter([
                __('Browser') => $context['browser'] ?? null,
                __('Operating system') => $context['operating_system'] ?? null,
                __('Browser language') => $context['language'] ?? null,
                __('Time zone') => $context['timezone'] ?? null,
                __('Browser window') => $context['viewport'] ?? null,
                'User-Agent' => $context['user_agent'] ?? null,
            ], fn (?string $value): bool => $value !== null && $value !== '')],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return array_map(
            fn (array $file): Attachment => Attachment::fromStorageDisk('local', $file['path'])
                ->as($file['name'])->withMime($file['mime']),
            $this->data->attachments,
        );
    }
}
