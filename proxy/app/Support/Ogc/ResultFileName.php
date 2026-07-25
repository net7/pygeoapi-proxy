<?php

namespace App\Support\Ogc;

use App\Models\ProcessExecution;
use Illuminate\Support\Str;

class ResultFileName
{
    public static function forOutput(
        ProcessExecution $execution,
        string $outputId,
        ?string $mediaType = null,
        ?string $extension = null,
    ): string {
        $prefix = self::segment($execution->remote_job_id ?: "job-{$execution->id}");
        $name = self::segment($outputId) ?: 'result';
        $fileName = "{$prefix}_{$name}";
        $extension ??= self::extensionForMediaType($mediaType);

        if ($extension !== null && ! self::hasExtension($fileName, $extension)) {
            return "{$fileName}.{$extension}";
        }

        return $fileName;
    }

    private static function segment(?string $value): string
    {
        return Str::of((string) $value)
            ->replaceMatches('/[^A-Za-z0-9._-]+/', '_')
            ->trim('._-')
            ->toString();
    }

    private static function hasExtension(string $fileName, string $extension): bool
    {
        return str_ends_with(Str::lower($fileName), '.'.Str::lower($extension));
    }

    private static function extensionForMediaType(?string $mediaType): ?string
    {
        $baseMediaType = Str::of((string) $mediaType)
            ->before(';')
            ->trim()
            ->lower()
            ->toString();

        return match (true) {
            $baseMediaType === 'application/json',
            str_ends_with($baseMediaType, '+json') => 'json',
            $baseMediaType === 'text/csv' => 'csv',
            $baseMediaType === 'text/plain' => 'txt',
            $baseMediaType === 'application/vnd.ogc.sld+xml' => 'sld',
            $baseMediaType === 'image/png' => 'png',
            $baseMediaType === 'image/jpeg' => 'jpg',
            $baseMediaType === 'image/gif' => 'gif',
            $baseMediaType === 'image/webp' => 'webp',
            str_contains($baseMediaType, 'tiff'),
            str_contains(Str::lower((string) $mediaType), 'geotiff') => 'geotiff',
            default => null,
        };
    }
}
