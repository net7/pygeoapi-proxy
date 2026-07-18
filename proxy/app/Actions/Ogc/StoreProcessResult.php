<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\MapLayerStatus;
use App\Enums\Ogc\ResultCacheStatus;
use App\Jobs\Ogc\PublishGeoTiffMapLayerJob;
use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use App\Services\Ogc\OgcResultResponseParser;
use App\Support\Ogc\ResultFileName;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StoreProcessResult
{
    public function __construct(
        private OgcResultResponseParser $parser,
        private OgcProcessesClient $client,
        private FindGeoTiffSldResultPairs $findGeoTiffSldResultPairs,
    ) {}

    public function fromResponse(ProcessExecution $execution, Response $response, ?string $outputId = null): void
    {
        if ($outputId === null && $execution->requested_outputs === []) {
            return;
        }

        foreach ($this->parser->parse($execution, $response, $outputId) as $result) {
            $storagePath = null;

            if ($result['storage_body'] !== null) {
                $storagePath = $this->storagePath($execution, $result['output_id'], $result['media_type']);
                Storage::disk('local')->put($storagePath, $result['storage_body']);
            } elseif ($result['remote_href'] !== null) {
                $remoteResponse = $this->client->downloadResultUrl($result['remote_href']);
                $storageBody = $remoteResponse->body();
                $remoteMediaType = Str::of((string) $remoteResponse->header('Content-Type'))
                    ->trim()
                    ->lower()
                    ->toString();

                $result['media_type'] = $remoteMediaType ?: $result['media_type'];
                $storagePath = $this->storagePath($execution, $result['output_id'], $result['media_type']);

                Storage::disk('local')->put($storagePath, $storageBody);

                $result['size_bytes'] = strlen($storageBody);
                $result['cache_status'] = ResultCacheStatus::Cached;
            }

            $execution->results()->updateOrCreate(
                ['output_id' => $result['output_id']],
                [
                    'title' => $result['title'],
                    'description' => $result['description'],
                    'media_type' => $result['media_type'],
                    'transmission_mode' => $result['transmission_mode'],
                    'remote_href' => $result['remote_href'],
                    'storage_path' => $storagePath,
                    'size_bytes' => $result['size_bytes'],
                    'cache_status' => $result['cache_status'],
                    'preview' => $result['preview'],
                ],
            );
        }

        $this->dispatchMapLayerPublication($execution);
    }

    /**
     * @param  array<string, mixed>  $link
     */
    public function fromLink(ProcessExecution $execution, array $link, ?string $outputId = null): void
    {
        if ($outputId === null && $execution->requested_outputs === []) {
            return;
        }

        $outputId ??= $this->firstRequestedOutputId($execution);
        $mediaType = Str::of((string) ($link['type'] ?? 'application/octet-stream'))->trim()->lower()->toString();
        $remoteHref = $link['href'] ?? null;
        $storagePath = null;
        $sizeBytes = null;
        $cacheStatus = ResultCacheStatus::MetadataOnly;

        if (is_string($remoteHref) && $remoteHref !== '') {
            $remoteResponse = $this->client->downloadResultUrl($remoteHref);
            $storageBody = $remoteResponse->body();
            $remoteMediaType = Str::of((string) $remoteResponse->header('Content-Type'))
                ->trim()
                ->lower()
                ->toString();
            $mediaType = $remoteMediaType ?: $mediaType;
            $storagePath = $this->storagePath($execution, $outputId, $mediaType);
            $sizeBytes = strlen($storageBody);
            $cacheStatus = ResultCacheStatus::Cached;

            Storage::disk('local')->put($storagePath, $storageBody);
        }

        $execution->results()->updateOrCreate(
            ['output_id' => $outputId],
            [
                'title' => $outputId,
                'description' => $link['title'] ?? null,
                'media_type' => $mediaType,
                'transmission_mode' => data_get($execution->requested_outputs, "{$outputId}.transmissionMode", 'reference'),
                'remote_href' => $remoteHref,
                'storage_path' => $storagePath,
                'size_bytes' => $sizeBytes,
                'cache_status' => $cacheStatus,
                'preview' => ['kind' => 'binary', 'data' => ['mediaType' => $mediaType]],
            ],
        );

        $this->dispatchMapLayerPublication($execution);
    }

    private function firstRequestedOutputId(ProcessExecution $execution): string
    {
        return (string) (array_key_first($execution->requested_outputs ?? []) ?? 'result');
    }

    private function storagePath(ProcessExecution $execution, string $outputId, ?string $mediaType): string
    {
        return "ogc-results/{$execution->id}/".ResultFileName::forOutput($execution, $outputId, $mediaType);
    }

    private function dispatchMapLayerPublication(ProcessExecution $execution): void
    {
        $execution->load('results');

        foreach ($this->findGeoTiffSldResultPairs->handle($execution) as $pair) {
            $geotiff = $pair['geotiff'];

            if (in_array($geotiff->map_layer_status, [
                MapLayerStatus::Pending,
                MapLayerStatus::Publishing,
                MapLayerStatus::Published,
            ], true)) {
                continue;
            }

            $geotiff->update([
                'map_layer_status' => MapLayerStatus::Pending,
                'map_layer_type' => 'wms',
                'map_layer_error' => null,
            ]);

            PublishGeoTiffMapLayerJob::dispatch($execution->id, $geotiff->id, $pair['sld']->id);
        }
    }
}
