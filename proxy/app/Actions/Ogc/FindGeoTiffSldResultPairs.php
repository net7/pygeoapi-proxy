<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class FindGeoTiffSldResultPairs
{
    /**
     * @return Collection<int, array{geotiff: ProcessExecutionResult, sld: ProcessExecutionResult}>
     */
    public function handle(ProcessExecution $execution): Collection
    {
        $components = [];
        $results = $execution->relationLoaded('results')
            ? $execution->results
            : $execution->results()->get();

        foreach ($results as $result) {
            $match = $this->outputComponentMatch($result->output_id);

            if ($match === null) {
                continue;
            }

            [$outputId, $component] = $match;
            $components[$outputId][$component] = $result;
        }

        return collect($components)
            ->map(function (array $outputComponents): ?array {
                $geotiff = $outputComponents['geotiff'] ?? null;
                $sld = $outputComponents['sld'] ?? null;

                if (! $geotiff instanceof ProcessExecutionResult || ! $sld instanceof ProcessExecutionResult) {
                    return null;
                }

                if (! $this->isCachedGeoTiff($geotiff) || ! $this->isCachedSld($sld)) {
                    return null;
                }

                return [
                    'geotiff' => $geotiff,
                    'sld' => $sld,
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function outputComponentMatch(string $outputId): ?array
    {
        if (! preg_match('/^(.+)\.(geotiff|sld)$/', $outputId, $matches)) {
            return null;
        }

        return [$matches[1], $matches[2]];
    }

    private function isCachedGeoTiff(ProcessExecutionResult $result): bool
    {
        $mediaType = $this->normalizedMediaType($result->media_type);
        $isTiff = Str::startsWith($mediaType, ['image/tiff', 'application/tiff']);

        return $isTiff && $result->cache_status === ResultCacheStatus::Cached && filled($result->storage_path);
    }

    private function isCachedSld(ProcessExecutionResult $result): bool
    {
        return $this->baseMediaType($result->media_type) === 'application/vnd.ogc.sld+xml'
            && $result->cache_status === ResultCacheStatus::Cached
            && filled($result->storage_path);
    }

    private function normalizedMediaType(?string $mediaType): string
    {
        return Str::of((string) $mediaType)->trim()->lower()->toString();
    }

    private function baseMediaType(?string $mediaType): string
    {
        return Str::of($this->normalizedMediaType($mediaType))->before(';')->trim()->toString();
    }
}
