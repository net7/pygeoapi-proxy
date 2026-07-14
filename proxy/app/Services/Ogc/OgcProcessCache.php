<?php

namespace App\Services\Ogc;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class OgcProcessCache
{
    public const CatalogKey = 'ogc-processes.catalog';

    public const LatestCatalogKey = 'ogc-processes.latest.catalog';

    public const WarmupLockKey = 'ogc-processes.warmup.lock';

    public const WarmupDispatchedKey = 'ogc-processes.warmup.dispatched';

    public function __construct(private OgcProcessesClient $client) {}

    /**
     * @return array<string, mixed>|null
     */
    public function catalog(): ?array
    {
        return $this->freshCatalog() ?? $this->latestCatalog();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function freshCatalog(): ?array
    {
        $catalog = Cache::get(self::CatalogKey);

        return is_array($catalog) ? $catalog : null;
    }

    public function hasFreshCatalog(): bool
    {
        return $this->freshCatalog() !== null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function process(string $processId): ?array
    {
        return $this->freshProcess($processId) ?? $this->latestProcess($processId);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function freshProcess(string $processId): ?array
    {
        $process = Cache::get($this->processKey($processId));

        return is_array($process) ? $process : null;
    }

    public function hasFreshProcess(string $processId): bool
    {
        return $this->freshProcess($processId) !== null;
    }

    public function catalogLastUpdatedAt(): ?string
    {
        return $this->latestUpdatedAt(self::LatestCatalogKey);
    }

    public function processLastUpdatedAt(string $processId): ?string
    {
        return $this->latestUpdatedAt($this->latestProcessKey($processId));
    }

    /**
     * @param  array<string, mixed>  $catalog
     */
    public function putCatalog(array $catalog, ?string $updatedAt = null): void
    {
        $updatedAt ??= now()->toIso8601String();

        Cache::put(self::CatalogKey, $catalog, $this->ttl());
        Cache::forever(self::LatestCatalogKey, $this->latestPayload($catalog, $updatedAt));
    }

    /**
     * @param  array<string, mixed>  $process
     */
    public function putProcess(string $processId, array $process, ?string $updatedAt = null): void
    {
        $updatedAt ??= now()->toIso8601String();

        Cache::put($this->processKey($processId), $process, $this->ttl());
        Cache::forever($this->latestProcessKey($processId), $this->latestPayload($process, $updatedAt));
    }

    public function warm(): void
    {
        $loadedProcesses = 0;

        try {
            $catalog = $this->client->processes();
            $processes = [];

            foreach ($this->processIds($catalog) as $processId) {
                $processes[$processId] = $this->client->process($processId);
                $loadedProcesses++;
            }

            $updatedAt = now()->toIso8601String();

            $this->putCatalog($catalog, $updatedAt);

            foreach ($processes as $processId => $process) {
                $this->putProcess($processId, $process, $updatedAt);
            }

            Log::info('OGC process cache warm-up completed.', [
                'base_url' => $this->baseUrl(),
                'process_count' => $loadedProcesses,
            ]);
        } catch (Throwable $exception) {
            Log::error('OGC process cache warm-up failed.', [
                'base_url' => $this->baseUrl(),
                'loaded_process_count' => $loadedProcesses,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    /**
     * @param  array<string, mixed>  $catalog
     * @return array<int, string>
     */
    public function processIds(array $catalog): array
    {
        $ids = [];

        foreach (($catalog['processes'] ?? []) as $process) {
            if (! is_array($process)) {
                continue;
            }

            $id = $process['id'] ?? null;

            if (! is_string($id) || $id === '') {
                continue;
            }

            $ids[] = $id;
        }

        return array_values(array_unique($ids));
    }

    public function processKey(string $processId): string
    {
        return "ogc-processes.process.{$processId}";
    }

    public function latestProcessKey(string $processId): string
    {
        return "ogc-processes.latest.process.{$processId}";
    }

    /**
     * @return array<string, mixed>|null
     */
    private function latestCatalog(): ?array
    {
        return $this->latestData(self::LatestCatalogKey);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function latestProcess(string $processId): ?array
    {
        return $this->latestData($this->latestProcessKey($processId));
    }

    /**
     * @return array{data: array<string, mixed>, updated_at: string}
     */
    private function latestPayload(array $data, string $updatedAt): array
    {
        return [
            'data' => $data,
            'updated_at' => $updatedAt,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function latestData(string $key): ?array
    {
        $payload = Cache::get($key);

        if (! is_array($payload)) {
            return null;
        }

        $data = $payload['data'] ?? null;

        return is_array($data) ? $data : null;
    }

    private function latestUpdatedAt(string $key): ?string
    {
        $payload = Cache::get($key);

        if (! is_array($payload)) {
            return null;
        }

        $updatedAt = $payload['updated_at'] ?? null;

        return is_string($updatedAt) && $updatedAt !== '' ? $updatedAt : null;
    }

    private function ttl(): int
    {
        return max(1, (int) config('services.ogc_processes.cache_ttl', 300));
    }

    private function baseUrl(): string
    {
        return (string) config('services.ogc_processes.base_url');
    }
}
