<?php

namespace App\Services\Support;

use App\Support\SupportPayload;
use Closure;
use Illuminate\Support\Facades\Redis;

class SupportHorizonPruner
{
    private const INDICES = [
        'recent_jobs', 'pending_jobs', 'completed_jobs', 'silenced_jobs',
        'failed_jobs', 'recent_failed_jobs', 'monitored_jobs',
    ];

    public function pruneExpired(int $now, Closure $withLock): int
    {
        if (config('queue.connections.'.config('queue.default').'.driver') !== 'redis') {
            return 0;
        }
        $redis = Redis::connection('horizon');
        $count = 0;
        foreach (self::INDICES as $index) {
            $offset = 0;
            do {
                $batch = $redis->zrange($index, $offset, $offset + 99);
                $removed = 0;
                foreach ($batch as $jobId) {
                    $job = $redis->hgetall($jobId);
                    if (($job['queue'] ?? null) !== config('support.queue') || ! is_string($job['payload'] ?? null)) {
                        continue;
                    }
                    $meta = SupportPayload::metadata($job['payload']);
                    if ($meta === null || $meta['expires_at'] > $now) {
                        continue;
                    }
                    $removed += $withLock($meta['id'], fn (): int => (int) $redis->eval(<<<'LUA'
if redis.call('hget', KEYS[1], 'payload') ~= ARGV[1]
    or redis.call('hget', KEYS[1], 'queue') ~= ARGV[2] then
    return 0
end
redis.call('del', KEYS[1])
for i = 2, #KEYS do
    redis.call('zrem', KEYS[i], ARGV[3])
end
return 1
LUA,
                        8, $jobId, ...[...self::INDICES, $job['payload'], config('support.queue'), $jobId],
                    ));
                }
                $count += $removed;
                $offset += max(0, count($batch) - $removed);
            } while (count($batch) === 100);
        }

        return $count;
    }
}
