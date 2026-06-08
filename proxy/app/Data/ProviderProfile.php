<?php

namespace App\Data;

use Illuminate\Support\Str;

final readonly class ProviderProfile
{
    /**
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public string $provider,
        public string $providerUserId,
        public ?string $name,
        public ?string $email,
        public bool $emailVerified,
        public ?string $avatar,
        public array $raw = [],
    ) {}

    public function normalizedEmail(): ?string
    {
        return $this->email === null ? null : Str::lower($this->email);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(): array
    {
        return [
            'provider' => $this->provider,
            'provider_user_id' => $this->providerUserId,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->emailVerified,
            'avatar' => $this->avatar,
            'raw' => $this->raw,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromPayload(array $payload): self
    {
        return new self(
            provider: (string) $payload['provider'],
            providerUserId: (string) $payload['provider_user_id'],
            name: $payload['name'] === null ? null : (string) $payload['name'],
            email: $payload['email'] === null ? null : (string) $payload['email'],
            emailVerified: (bool) $payload['email_verified'],
            avatar: $payload['avatar'] === null ? null : (string) $payload['avatar'],
            raw: is_array($payload['raw']) ? $payload['raw'] : [],
        );
    }
}
