<?php

namespace App\Actions\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;

class StoreProcessResult
{
    public function fromResponse(ProcessExecution $execution, Response $response, ?string $outputId = null): void
    {
        $mediaType = Str::of((string) $response->header('Content-Type'))->before(';')->trim()->toString();
        $body = $response->body();
        $json = $response->json();
        $outputId ??= $this->firstRequestedOutputId($execution);

        $execution->results()->updateOrCreate(
            ['output_id' => $outputId],
            [
                'title' => $outputId,
                'description' => null,
                'media_type' => $mediaType ?: 'application/json',
                'transmission_mode' => data_get($execution->requested_outputs, "{$outputId}.transmissionMode", 'value'),
                'remote_href' => null,
                'storage_path' => null,
                'size_bytes' => strlen($body),
                'cache_status' => ResultCacheStatus::Cached,
                'preview' => $this->preview($mediaType, $json, $body),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $link
     */
    public function fromLink(ProcessExecution $execution, array $link, ?string $outputId = null): void
    {
        $outputId ??= $this->firstRequestedOutputId($execution);
        $mediaType = Str::of((string) ($link['type'] ?? 'application/octet-stream'))->before(';')->trim()->toString();

        $execution->results()->updateOrCreate(
            ['output_id' => $outputId],
            [
                'title' => $outputId,
                'description' => $link['title'] ?? null,
                'media_type' => $mediaType,
                'transmission_mode' => data_get($execution->requested_outputs, "{$outputId}.transmissionMode", 'reference'),
                'remote_href' => $link['href'] ?? null,
                'storage_path' => null,
                'size_bytes' => null,
                'cache_status' => ResultCacheStatus::MetadataOnly,
                'preview' => ['kind' => 'binary', 'data' => ['mediaType' => $mediaType]],
            ],
        );
    }

    /**
     * @param  array<string, mixed>|null  $json
     * @return array<string, mixed>
     */
    private function preview(string $mediaType, ?array $json, string $body): array
    {
        if (is_array($json) && isset($json['chartType'], $json['domain'], $json['series'])) {
            return ['kind' => 'chart', 'data' => $json];
        }

        if (is_array($json)) {
            return ['kind' => 'json', 'data' => $json];
        }

        if ($mediaType === 'text/csv') {
            return ['kind' => 'csv', 'data' => str($body)->limit(50000)->toString()];
        }

        if (str_starts_with($mediaType, 'text/')) {
            return ['kind' => 'text', 'data' => str($body)->limit(50000)->toString()];
        }

        return ['kind' => 'binary', 'data' => ['mediaType' => $mediaType]];
    }

    private function firstRequestedOutputId(ProcessExecution $execution): string
    {
        return (string) (array_key_first($execution->requested_outputs ?? []) ?? 'result');
    }
}
