<?php

namespace App\Services\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Str;

class OgcResultResponseParser
{
    public function __construct(
        private OgcProcessesClient $client,
        private CsvPreviewBuilder $csvPreviewBuilder,
    ) {}

    /**
     * @return array<int, array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     remote_href: string|null,
     *     size_bytes: int|null,
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
            $jsonResults = $this->resultsFromJsonBody(
                execution: $execution,
                body: $response->body(),
                mediaType: $mediaType ?: 'application/json',
                outputId: $outputId,
            );

            if ($jsonResults !== null) {
                return $jsonResults;
            }

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
            ->flatMap(fn (array $part, int $index): array => $this->resultsFromPart(
                execution: $execution,
                part: $part,
                fallbackOutputId: $requestedOutputIds[$index] ?? 'part-'.($index + 1),
            ))
            ->all();
    }

    /**
     * @param  array{headers: array<string, string>, body: string}  $part
     * @return array<int, array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     remote_href: string|null,
     *     size_bytes: int|null,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }>
     */
    private function resultsFromPart(ProcessExecution $execution, array $part, string $fallbackOutputId): array
    {
        $headers = $part['headers'];
        $outputId = $this->partOutputId($headers, $fallbackOutputId);
        $mediaType = $this->mediaType($headers['content-type'] ?? '');
        $body = $part['body'];

        if ($this->isJsonMediaType($mediaType)) {
            if (trim($body) === '' && isset($headers['content-location'])) {
                $remoteResponse = $this->client->downloadResultUrl($headers['content-location']);
                $body = $remoteResponse->body();
                $mediaType = $this->mediaType((string) $remoteResponse->header('Content-Type')) ?: $mediaType;
            }

            $jsonResults = $this->resultsFromJsonBody(
                execution: $execution,
                body: $body,
                mediaType: $mediaType ?: 'application/json',
                outputId: $outputId,
            );

            if ($jsonResults !== null) {
                return $jsonResults;
            }
        }

        return [$this->resultFromBody(
            execution: $execution,
            outputId: $outputId,
            body: $body,
            mediaType: $mediaType,
            forceStorage: true,
        )];
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
     *     remote_href: string|null,
     *     size_bytes: int|null,
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
            'remote_href' => null,
            'size_bytes' => strlen($body),
            'cache_status' => ResultCacheStatus::Cached,
            'preview' => $preview,
            'storage_body' => $storageBody,
        ];
    }

    /**
     * @return array<int, array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     remote_href: string|null,
     *     size_bytes: int|null,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }>|null
     */
    private function resultsFromJsonBody(
        ProcessExecution $execution,
        string $body,
        string $mediaType,
        ?string $outputId,
    ): ?array {
        $json = $this->json($body);

        if (! is_array($json)) {
            return null;
        }

        $requestedOutputIds = $outputId !== null
            ? [$outputId]
            : array_keys($execution->requested_outputs ?? []);

        if ($requestedOutputIds === []) {
            $requestedOutputIds = [$this->firstRequestedOutputId($execution)];
        }

        $payload = $this->jsonResultsPayload($json);
        $matchedOutputs = [];

        foreach ($requestedOutputIds as $requestedOutputId) {
            if (array_key_exists($requestedOutputId, $payload)) {
                $matchedOutputs[$requestedOutputId] = $payload[$requestedOutputId];
            }
        }

        if ($matchedOutputs === [] && count($requestedOutputIds) === 1) {
            $matchedOutputs[$requestedOutputIds[0]] = $payload;
        }

        if ($matchedOutputs === []) {
            return null;
        }

        $results = [];

        foreach ($matchedOutputs as $matchedOutputId => $value) {
            array_push(
                $results,
                ...$this->resultsFromJsonValue(
                    execution: $execution,
                    outputId: (string) $matchedOutputId,
                    value: $value,
                    fallbackMediaType: $mediaType,
                ),
            );
        }

        return $results === [] ? null : $results;
    }

    /**
     * @param  array<string, mixed>  $json
     * @return array<string, mixed>
     */
    private function jsonResultsPayload(array $json): array
    {
        $outputs = $json['outputs'] ?? null;

        return is_array($outputs) ? $outputs : $json;
    }

    /**
     * @return array<int, array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     remote_href: string|null,
     *     size_bytes: int|null,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }>
     */
    private function resultsFromJsonValue(
        ProcessExecution $execution,
        string $outputId,
        mixed $value,
        string $fallbackMediaType,
    ): array {
        if (is_array($value) && $this->isLink($value)) {
            return [$this->resultFromLinkValue($execution, $outputId, $value)];
        }

        if (is_array($value)) {
            $linkResults = $this->nestedLinkResults($execution, $outputId, $value);

            if ($linkResults !== []) {
                return $linkResults;
            }
        }

        $mediaType = $this->outputMediaType($execution, $outputId) ?: $fallbackMediaType ?: 'application/json';
        $body = $this->bodyFromJsonValue($value, $mediaType);

        return [$this->resultFromBody(
            execution: $execution,
            outputId: $outputId,
            body: $body,
            mediaType: $mediaType,
            forceStorage: false,
        )];
    }

    /**
     * @param  array<string, mixed>  $value
     * @return array<int, array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     remote_href: string|null,
     *     size_bytes: int|null,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }>
     */
    private function nestedLinkResults(ProcessExecution $execution, string $outputId, array $value): array
    {
        $results = [];

        foreach ($value as $componentId => $componentValue) {
            if (! is_string($componentId) || ! is_array($componentValue) || ! $this->isLink($componentValue)) {
                continue;
            }

            $results[] = $this->resultFromLinkValue($execution, $outputId, $componentValue, $componentId);
        }

        return $results;
    }

    /**
     * @param  array<string, mixed>  $link
     * @return array{
     *     output_id: string,
     *     title: string|null,
     *     description: string|null,
     *     media_type: string,
     *     transmission_mode: string,
     *     remote_href: string|null,
     *     size_bytes: int|null,
     *     cache_status: ResultCacheStatus,
     *     preview: array<string, mixed>,
     *     storage_body: string|null
     * }
     */
    private function resultFromLinkValue(
        ProcessExecution $execution,
        string $outputId,
        array $link,
        ?string $componentId = null,
    ): array {
        $resultOutputId = $componentId === null ? $outputId : "{$outputId}.{$componentId}";
        $mediaType = $this->linkMediaType((string) ($link['type'] ?? '')) ?: 'application/octet-stream';

        return [
            'output_id' => $resultOutputId,
            'title' => $this->linkTitle($execution, $outputId, $link, $componentId),
            'description' => $this->linkDescription($execution, $outputId, $link, $componentId),
            'media_type' => $mediaType,
            'transmission_mode' => data_get($execution->requested_outputs, "{$outputId}.transmissionMode", 'reference'),
            'remote_href' => (string) $link['href'],
            'size_bytes' => null,
            'cache_status' => ResultCacheStatus::MetadataOnly,
            'preview' => ['kind' => 'binary', 'data' => ['mediaType' => $mediaType]],
            'storage_body' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $link
     */
    private function linkTitle(ProcessExecution $execution, string $outputId, array $link, ?string $componentId): string
    {
        $outputTitle = (string) (data_get($execution->process_outputs, "{$outputId}.title") ?? $outputId);

        if ($componentId === null) {
            return $outputTitle;
        }

        $componentTitle = (string) ($link['title']
            ?? data_get($execution->process_outputs, "{$outputId}.schema.properties.{$componentId}.title")
            ?? Str::headline($componentId));

        return "{$outputTitle} - {$componentTitle}";
    }

    /**
     * @param  array<string, mixed>  $link
     */
    private function linkDescription(ProcessExecution $execution, string $outputId, array $link, ?string $componentId): ?string
    {
        if (isset($link['title']) && is_string($link['title']) && $link['title'] !== '') {
            return $link['title'];
        }

        if ($componentId !== null) {
            $componentDescription = data_get($execution->process_outputs, "{$outputId}.schema.properties.{$componentId}.description");

            if (is_string($componentDescription) && $componentDescription !== '') {
                return $componentDescription;
            }
        }

        $description = data_get($execution->process_outputs, "{$outputId}.description");

        return is_string($description) && $description !== '' ? $description : null;
    }

    /**
     * @param  array<string, mixed>  $link
     */
    private function isLink(array $link): bool
    {
        return isset($link['href']) && is_string($link['href']) && $link['href'] !== '';
    }

    private function outputMediaType(ProcessExecution $execution, string $outputId): string
    {
        return $this->mediaType((string) data_get($execution->process_outputs, "{$outputId}.schema.contentMediaType"));
    }

    private function bodyFromJsonValue(mixed $value, string $mediaType): string
    {
        if (is_string($value) && ! str_contains($mediaType, 'json')) {
            return $value;
        }

        return json_encode($value, JSON_THROW_ON_ERROR);
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
            return ['kind' => 'csv', 'data' => $this->csvPreviewBuilder->fromString($body)];
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

    private function linkMediaType(string $contentType): string
    {
        return Str::of($contentType)->trim()->lower()->toString();
    }

    private function isJsonMediaType(string $mediaType): bool
    {
        return $mediaType === 'application/json' || str_ends_with($mediaType, '+json');
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
