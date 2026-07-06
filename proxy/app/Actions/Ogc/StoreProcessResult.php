<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use App\Services\Ogc\OgcProcessesClient;
use App\Services\Ogc\OgcResultResponseParser;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StoreProcessResult
{
    public function __construct(
        private OgcResultResponseParser $parser,
        private OgcProcessesClient $client,
    ) {}

    public function fromResponse(ProcessExecution $execution, Response $response, ?string $outputId = null): void
    {
        foreach ($this->parser->parse($execution, $response, $outputId) as $result) {
            $storagePath = null;

            if ($result['storage_body'] !== null) {
                $storagePath = "ogc-results/{$execution->id}/".$this->resultFileName($result['output_id']);
                Storage::disk('local')->put($storagePath, $result['storage_body']);
            } elseif ($result['remote_href'] !== null) {
                $remoteResponse = $this->client->downloadResultUrl($result['remote_href']);
                $storagePath = "ogc-results/{$execution->id}/".$this->resultFileName($result['output_id']);
                $storageBody = $remoteResponse->body();

                Storage::disk('local')->put($storagePath, $storageBody);

                $result['media_type'] = Str::of((string) $remoteResponse->header('Content-Type'))
                    ->trim()
                    ->lower()
                    ->toString() ?: $result['media_type'];
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
    }

    /**
     * @param  array<string, mixed>  $link
     */
    public function fromLink(ProcessExecution $execution, array $link, ?string $outputId = null): void
    {
        $outputId ??= $this->firstRequestedOutputId($execution);
        $mediaType = Str::of((string) ($link['type'] ?? 'application/octet-stream'))->trim()->lower()->toString();
        $remoteHref = $link['href'] ?? null;
        $storagePath = null;
        $sizeBytes = null;
        $cacheStatus = ResultCacheStatus::MetadataOnly;

        if (is_string($remoteHref) && $remoteHref !== '') {
            $remoteResponse = $this->client->downloadResultUrl($remoteHref);
            $storageBody = $remoteResponse->body();
            $storagePath = "ogc-results/{$execution->id}/".$this->resultFileName($outputId);
            $sizeBytes = strlen($storageBody);
            $cacheStatus = ResultCacheStatus::Cached;
            $mediaType = Str::of((string) $remoteResponse->header('Content-Type'))
                ->trim()
                ->lower()
                ->toString() ?: $mediaType;

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
    }

    private function firstRequestedOutputId(ProcessExecution $execution): string
    {
        return (string) (array_key_first($execution->requested_outputs ?? []) ?? 'result');
    }

    private function resultFileName(string $outputId): string
    {
        $fileName = Str::of($outputId)
            ->replaceMatches('/[^A-Za-z0-9._-]+/', '_')
            ->trim('._-')
            ->toString();

        return $fileName !== '' ? $fileName : 'result';
    }
}
