<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SupportClientContext
{
    /**
     * @param  array{language?:string|null,timezone?:string|null,viewport_width?:int|string|null,viewport_height?:int|string|null}  $client
     * @return array<string, string>
     */
    public static function collect(Request $request, array $client): array
    {
        $agent = Str::substr(trim(preg_replace('/[\x00-\x1f\x7f]/', '', (string) $request->userAgent())), 0, 1024);

        return array_filter([
            'browser' => self::browser($agent),
            'operating_system' => self::operatingSystem($agent),
            'language' => $client['language'] ?? null,
            'timezone' => $client['timezone'] ?? null,
            'viewport' => isset($client['viewport_width'], $client['viewport_height'])
                ? (int) $client['viewport_width'].' × '.(int) $client['viewport_height'].' px'
                : null,
            'user_agent' => $agent,
        ], fn (?string $value): bool => $value !== null && $value !== '');
    }

    private static function browser(string $agent): ?string
    {
        $patterns = [
            'Microsoft Edge' => '/(?:Edg|EdgA|EdgiOS)\/([\d.]+)/',
            'Opera' => '/OPR\/([\d.]+)/',
            'Samsung Internet' => '/SamsungBrowser\/([\d.]+)/',
            'Firefox' => '/(?:Firefox|FxiOS)\/([\d.]+)/',
            'Chrome' => '/(?:Chrome|CriOS)\/([\d.]+)/',
            'Safari' => '/Version\/([\d.]+).*Safari\//',
        ];
        foreach ($patterns as $name => $pattern) {
            if (preg_match($pattern, $agent, $matches)) {
                return $name.' '.$matches[1];
            }
        }

        return null;
    }

    private static function operatingSystem(string $agent): ?string
    {
        return match (true) {
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'iPhone'), str_contains($agent, 'iPad'), str_contains($agent, 'iPod') => 'iOS',
            str_contains($agent, 'Windows NT') => 'Windows',
            str_contains($agent, 'CrOS') => 'Chrome OS',
            str_contains($agent, 'Macintosh'), str_contains($agent, 'Mac OS X') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => null,
        };
    }
}
