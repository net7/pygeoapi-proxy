<?php

namespace App\Support;

class AuthFeatures
{
    public static function google(): string
    {
        return 'google-auth';
    }

    public static function orcid(): string
    {
        return 'orcid-auth';
    }

    public static function emailOtp(): string
    {
        return 'email-otp';
    }

    public static function passwordLogin(): string
    {
        return 'password-login';
    }

    public static function enabled(string $feature): bool
    {
        return in_array($feature, config('fortify.features', []), true);
    }

    /**
     * @return list<string>
     */
    public static function enabledProviders(): array
    {
        return array_values(array_filter([
            self::enabled(self::google()) ? 'google' : null,
            self::enabled(self::orcid()) ? 'orcid' : null,
        ]));
    }

    public static function providerEnabled(string $provider): bool
    {
        return match ($provider) {
            'google' => self::enabled(self::google()),
            'orcid' => self::enabled(self::orcid()),
            default => false,
        };
    }
}
