<?php

namespace App\Data;

use App\Models\User;

final readonly class SocialLoginResult
{
    public const Authenticated = 'authenticated';

    public const NeedsEmail = 'needs-email';

    /**
     * @param  array<string, mixed>|null  $pendingProfile
     */
    private function __construct(
        public string $status,
        public ?User $user = null,
        public ?array $pendingProfile = null,
    ) {}

    public static function authenticated(User $user): self
    {
        return new self(self::Authenticated, user: $user);
    }

    /**
     * @param  array<string, mixed>  $pendingProfile
     */
    public static function needsEmail(array $pendingProfile): self
    {
        return new self(self::NeedsEmail, pendingProfile: $pendingProfile);
    }
}
