<?php

namespace App\Services\Ogc;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class OgcProcessCache
{
    public const CatalogKey = 'ogc-processes.catalog';

    public const WarmupLockKey = 'ogc-processes.warmup.lock';

    public const WarmupDispatchedKey = 'ogc-processes.warmup.dispatched';

    public function __construct(private OgcProcessesClient $client) {}

    /**
     * @return array<string, mixed>|null
     */
    public function catalog(): ?array
    {
        $catalog = Cache::get(self::CatalogKey);

        return is_array($catalog) ? $catalog : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function process(string $processId): ?array
    {
        $process = Cache::get($this->processKey($processId));

        return is_array($process) ? $process : null;
    }

    /**
     * @param  array<string, mixed>  $catalog
     */
    public function putCatalog(array $catalog): void
    {
        Cache::put(self::CatalogKey, $catalog, $this->ttl());
    }

    /**
     * @param  array<string, mixed>  $process
     */
    public function putProcess(string $processId, array $process): void
    {
        Cache::put($this->processKey($processId), $process, $this->ttl());
    }

    public function warm(): void
    {
        $loadedProcesses = 0;

        try {
            $catalog = $this->client->processes();
            $this->putCatalog($catalog);

            foreach ($this->processIds($catalog) as $processId) {
                $this->putProcess($processId, $this->client->process($processId));
                $loadedProcesses++;
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

    private function ttl(): int
    {
        return max(1, (int) config('services.ogc_processes.cache_ttl', 300));
    }

    private function baseUrl(): string
    {
        return (string) config('services.ogc_processes.base_url');
    }
}
