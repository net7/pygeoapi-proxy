<?php

namespace App\Services\Ogc;

use App\Jobs\Ogc\WarmOgcProcessCacheJob;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class OgcProcessCacheWarmupDispatcher
{
    /**
     * @var array<int, string>
     */
    private const RuntimeCommands = [
        'queue:work',
        'queue:listen',
        'horizon',
        'horizon:listen',
        'horizon:work',
    ];

    private const DispatchFlagTtlSeconds = 300;

    public function dispatchIfAppropriate(): bool
    {
        if (app()->runningUnitTests()) {
            return false;
        }

        return $this->dispatchForCommand($this->currentCommand());
    }

    public function dispatchForCommand(?string $command): bool
    {
        if (! is_string($command) || ! in_array($command, self::RuntimeCommands, true)) {
            return false;
        }

        try {
            if (! Cache::add(OgcProcessCache::WarmupDispatchedKey, true, self::DispatchFlagTtlSeconds)) {
                return false;
            }

            WarmOgcProcessCacheJob::dispatch();

            return true;
        } catch (Throwable $exception) {
            Log::warning('Unable to dispatch OGC process cache warm-up.', [
                'command' => $command,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function currentCommand(): ?string
    {
        $command = $_SERVER['argv'][1] ?? null;

        return is_string($command) ? $command : null;
    }
}
