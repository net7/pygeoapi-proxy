<?php

namespace App\Services\Auth;

use App\Models\EmailOtpChallenge;
use App\Notifications\EmailOtpNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class EmailOtpService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function createAndSend(string $email, string $purpose, array $payload = [], ?string $code = null): EmailOtpChallenge
    {
        $normalizedEmail = Str::lower($email);
        $plainCode = $code ?? (string) random_int(100000, 999999);

        $challenge = EmailOtpChallenge::create([
            'uuid' => (string) Str::uuid(),
            'email' => $normalizedEmail,
            'purpose' => $purpose,
            'code_hash' => Hash::make($plainCode),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'payload' => $payload,
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'auth.otp.show',
            $challenge->expires_at,
            ['challenge' => $challenge],
        );

        Notification::route('mail', $normalizedEmail)
            ->notify((new EmailOtpNotification($challenge, $plainCode, $signedUrl))
                ->locale(app()->getLocale())
                ->afterCommit());

        return $challenge;
    }

    public function resend(EmailOtpChallenge $challenge): ?EmailOtpChallenge
    {
        return DB::transaction(function () use ($challenge): ?EmailOtpChallenge {
            $challenge = EmailOtpChallenge::query()->lockForUpdate()->findOrFail($challenge->getKey());

            if ($challenge->isConsumed()) {
                return null;
            }

            $challenge->consume();

            return $this->createAndSend($challenge->email, $challenge->purpose, $challenge->payload ?? []);
        });
    }

    public function verify(EmailOtpChallenge $challenge, string $purpose, string $code): bool
    {
        return DB::transaction(function () use ($challenge, $purpose, $code): bool {
            $challenge = EmailOtpChallenge::query()->lockForUpdate()->findOrFail($challenge->getKey());

            if ($challenge->purpose !== $purpose || ! $challenge->canAttempt()) {
                return false;
            }

            if (! Hash::check($code, $challenge->code_hash)) {
                $challenge->increment('attempts');

                return false;
            }

            $challenge->consume();

            return true;
        });
    }
}
