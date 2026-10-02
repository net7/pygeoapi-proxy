<?php

namespace App\Services\Support;

use App\Support\SupportPayload;
use Closure;
use Illuminate\Redis\Connections\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use RuntimeException;

class SupportQueuePruner
{
    public function pruneExpired(int $now, Closure $withLock): int
    {
        $configuration = config('queue.connections.'.config('queue.default'));
        $count = match ($configuration['driver'] ?? null) {
            'database' => $this->pruneDatabase($configuration, $now, $withLock),
            'redis' => $this->pruneRedis($configuration, $now, $withLock),
            default => throw new RuntimeException('Unsupported support mail queue driver.'),
        };

        return $count + $this->pruneFailed($now, $withLock);
    }

    private function pruneDatabase(array $configuration, int $now, Closure $withLock): int
    {
        $query = DB::connection($configuration['connection'] ?? null)
            ->table($configuration['table'])->where('queue', config('support.queue'));
        $count = 0;
        foreach ((clone $query)->select(['id', 'payload'])->lazyById(100) as $job) {
            $meta = SupportPayload::metadata($job->payload);
            if ($meta !== null && $meta['expires_at'] <= $now) {
                $count += $withLock($meta['id'], fn (): int => (clone $query)
                    ->where('id', $job->id)->where('payload', $job->payload)->delete());
            }
        }

        return $count;
    }

    private function pruneRedis(array $configuration, int $now, Closure $withLock): int
    {
        $redis = Redis::connection($configuration['connection'] ?? 'default');
        $queue = config('support.queue');
        $key = $redis->isCluster() && ! Connection::hasHashTag($queue)
            ? 'queues:{'.$queue.'}' : 'queues:'.$queue;
        $count = 0;
        foreach ([$key, $key.':delayed', $key.':reserved'] as $index) {
            $pending = $index === $key;
            $offset = 0;
            do {
                $batch = $pending ? $redis->lrange($index, $offset, $offset + 99)
                    : $redis->zrange($index, $offset, $offset + 99);
                $removed = 0;
                foreach ($batch as $payload) {
                    $meta = SupportPayload::metadata($payload);
                    if ($meta !== null && $meta['expires_at'] <= $now) {
                        $removed += $withLock($meta['id'], fn (): int => $pending
                            ? $redis->lrem($index, 1, $payload) : $redis->zrem($index, $payload));
                    }
                }
                $count += $removed;
                $offset += max(0, count($batch) - $removed);
            } while (count($batch) === 100);
        }

        return $count;
    }

    private function pruneFailed(int $now, Closure $withLock): int
    {
        $configuration = config('queue.failed');
        if (($configuration['driver'] ?? null) === null) {
            return 0;
        }
        if (! in_array($configuration['driver'], ['database-uuids', 'database'], true)) {
            throw new RuntimeException('Unsupported support mail failed job driver.');
        }
        $query = DB::connection($configuration['database'] ?? null)
            ->table($configuration['table'])->where('queue', config('support.queue'));
        $columns = $configuration['driver'] === 'database-uuids' ? ['id', 'uuid', 'payload'] : ['id', 'payload'];
        $count = 0;
        foreach ((clone $query)->select($columns)->lazyById(100) as $job) {
            $meta = SupportPayload::metadata($job->payload);
            if ($meta !== null && $meta['expires_at'] <= $now) {
                $count += $withLock($meta['id'], function () use ($query, $job, $configuration): int {
                    if (! (clone $query)->where('id', $job->id)->where('payload', $job->payload)->exists()) {
                        return 0;
                    }

                    return (int) app('queue.failer')->forget(
                        $configuration['driver'] === 'database-uuids' ? $job->uuid : $job->id,
                    );
                });
            }
        }

        return $count;
    }
}
