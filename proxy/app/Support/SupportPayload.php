<?php

namespace App\Support;

use App\Jobs\SendSupportEmail;
use Illuminate\Support\Str;

class SupportPayload
{
    /** @return array{id:string,expires_at:int}|null */
    public static function metadata(string $payload): ?array
    {
        $decoded = json_decode($payload, true);
        if (! is_array($decoded) || ! is_array($decoded['data'] ?? null)) {
            return null;
        }
        $meta = $decoded['support_mail'] ?? null;
        if (($decoded['data']['commandName'] ?? null) !== SendSupportEmail::class
            || ! is_array($meta)
            || ! is_string($meta['id'] ?? null)
            || ! Str::isUuid($meta['id'])
            || ! is_int($meta['expires_at'] ?? null)
            || $meta['expires_at'] <= 0) {
            return null;
        }

        return ['id' => $meta['id'], 'expires_at' => $meta['expires_at']];
    }
}
