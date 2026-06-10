<?php

namespace App\Services\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;

class OgcResultResponseParser
{
    /**
     * @return array<int, array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     size_bytes: int,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }>
     */
    public function parse(ProcessExecution $execution, Response $response, ?string $outputId = null): array
    {
        $contentType = (string) $response->header('Content-Type');
        $mediaType = $this->mediaType($contentType);

        if (! str_starts_with($mediaType, 'multipart/')) {
            return [$this->resultFromBody(
                execution: $execution,
                outputId: $outputId ?? $this->firstRequestedOutputId($execution),
                body: $response->body(),
                mediaType: $mediaType ?: 'application/json',
                forceStorage: false,
            )];
        }

        $boundary = $this->boundary($contentType);

        if ($boundary === null) {
            return [$this->resultFromBody(
                execution: $execution,
                outputId: $outputId ?? $this->firstRequestedOutputId($execution),
                body: $response->body(),
                mediaType: $mediaType,
                forceStorage: false,
            )];
        }

        $requestedOutputIds = array_keys($execution->requested_outputs ?? []);

        return collect($this->parts($response->body(), $boundary))
            ->map(fn (array $part, int $index): array => $this->resultFromBody(
                execution: $execution,
                outputId: $this->partOutputId($part['headers'], $requestedOutputIds[$index] ?? 'part-'.($index + 1)),
                body: $part['body'],
                mediaType: $this->mediaType($part['headers']['content-type'] ?? ''),
                forceStorage: true,
            ))
            ->all();
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function partOutputId(array $headers, string $fallback): string
    {
        $contentDisposition = $headers['content-disposition'] ?? '';

        if (preg_match('/\bname=(?:"([^"]+)"|([^;\s]+))/', $contentDisposition, $matches) === 1) {
            return $matches[1] !== '' ? $matches[1] : $matches[2];
        }

        if (preg_match('/\bfilename=(?:"([^"]+)"|([^;\s]+))/', $contentDisposition, $matches) === 1) {
            return pathinfo($matches[1] !== '' ? $matches[1] : $matches[2], PATHINFO_FILENAME);
        }

        if (isset($headers['content-id'])) {
            return trim($headers['content-id'], " <>\t\n\r\0\x0B");
        }

        if (isset($headers['content-location'])) {
            return pathinfo(basename($headers['content-location']), PATHINFO_FILENAME);
        }

        return $fallback;
    }

    /**
     * @return array<int, array{headers: array<string, string>, body: string}>
     */
    private function parts(string $body, string $boundary): array
    {
        $parts = [];
        $segments = explode('--'.$boundary, $body);

        foreach ($segments as $segment) {
            $segment = ltrim($segment, "\r\n");

            if ($segment === '' || str_starts_with($segment, '--')) {
                continue;
            }

            [$rawHeaders, $partBody] = preg_split("/\r\n\r\n|\n\n/", $segment, 2) + ['', ''];
            $partBody = $this->stripTrailingBoundaryNewline($partBody);

            $parts[] = [
                'headers' => $this->headers($rawHeaders),
                'body' => $partBody,
            ];
        }

        return $parts;
    }

    /**
     * @return array<string, string>
     */
    private function headers(string $rawHeaders): array
    {
        $headers = [];

        foreach (preg_split("/\r\n|\n/", trim($rawHeaders)) ?: [] as $line) {
            if (! str_contains($line, ':')) {
                continue;
            }

            [$name, $value] = explode(':', $line, 2);
            $headers[strtolower(trim($name))] = trim($value);
        }

        return $headers;
    }

    private function stripTrailingBoundaryNewline(string $body): string
    {
        if (str_ends_with($body, "\r\n")) {
            return substr($body, 0, -2);
        }

        if (str_ends_with($body, "\n")) {
            return substr($body, 0, -1);
        }

        return $body;
    }

    /**
     * @return array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     size_bytes: int,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }
     */
    private function resultFromBody(
        ProcessExecution $execution,
        string $outputId,
        string $body,
        string $mediaType,
        bool $forceStorage,
    ): array {
        $processOutputs = $execution->process_outputs ?? [];
        $outputSpec = $processOutputs[$outputId] ?? [];
        $mediaType = $mediaType ?: $this->mediaType((string) data_get($outputSpec, 'schema.contentMediaType'));
        $mediaType = $mediaType ?: 'application/octet-stream';
        $preview = $this->preview($mediaType, $body);
        $storageBody = $forceStorage && $preview['kind'] === 'binary' ? $body : null;

        return [
            'output_id' => $outputId,
            'title' => $outputSpec['title'] ?? $outputId,
            'description' => $outputSpec['description'] ?? null,
            'media_type' => $mediaType,
            'transmission_mode' => data_get($execution->requested_outputs, "{$outputId}.transmissionMode", 'value'),
            'size_bytes' => strlen($body),
            'cache_status' => ResultCacheStatus::Cached,
            'preview' => $preview,
            'storage_body' => $storageBody,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function preview(string $mediaType, string $body): array
    {
        $json = $this->json($body);

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

        return [
            'kind' => 'binary',
            'data' => [
                'mediaType' => $mediaType,
                'sizeBytes' => strlen($body),
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function json(string $body): ?array
    {
        $json = json_decode($body, true);

        return is_array($json) ? $json : null;
    }

    private function mediaType(string $contentType): string
    {
        return Str::of($contentType)->before(';')->trim()->lower()->toString();
    }

    private function boundary(string $contentType): ?string
    {
        if (preg_match('/boundary=(?:"([^"]+)"|([^;\s]+))/', $contentType, $matches) !== 1) {
            return null;
        }

        return $matches[1] !== '' ? $matches[1] : $matches[2];
    }

    private function firstRequestedOutputId(ProcessExecution $execution): string
    {
        return (string) (array_key_first($execution->requested_outputs ?? []) ?? 'result');
    }
}
