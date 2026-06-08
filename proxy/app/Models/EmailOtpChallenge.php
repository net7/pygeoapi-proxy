<?php

namespace App\Models;

use Database\Factories\EmailOtpChallengeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'uuid',
    'email',
    'purpose',
    'code_hash',
    'attempts',
    'expires_at',
    'consumed_at',
    'payload',
])]
class EmailOtpChallenge extends Model
{
    /** @use HasFactory<EmailOtpChallengeFactory> */
    use HasFactory;

    public const PurposeSocialLogin = 'social-login';

    public const PurposeSensitiveConfirmation = 'sensitive-confirmation';

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function canAttempt(): bool
    {
        return ! $this->isConsumed()
            && ! $this->isExpired()
            && $this->attempts < 5;
    }

    public function consume(): void
    {
        $this->forceFill([
            'consumed_at' => now(),
        ])->save();
    }
}
