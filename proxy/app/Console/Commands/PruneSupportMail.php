<?php

namespace App\Console\Commands;

use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportHorizonPruner;
use App\Services\Support\SupportQueuePruner;
use Closure;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class PruneSupportMail extends Command
{
    protected $signature = 'support:prune';

    protected $description = 'Remove expired support email data without affecting other queues or files';

    public function handle(SupportAttachments $files, SupportQueuePruner $queues, SupportHorizonPruner $horizon): int
    {
        $now = now()->timestamp;
        $errors = 0;
        $withLock = function (string $id, Closure $operation) use (&$errors): int {
            $lock = Cache::lock('support-mail:'.$id, (int) config('support.lock_seconds'));
            $acquired = false;
            try {
                $started = hrtime(true);
                $acquired = $lock->get();
                if (! $acquired) {
                    return 0;
                }
                if (hrtime(true) - $started >= 60_000_000_000 || ! $lock->isOwnedByCurrentProcess()) {
                    throw new RuntimeException('Support cleanup lock expired.');
                }

                return $operation();
            } catch (Throwable $exception) {
                $errors++;
                Log::warning('Support mail cleanup failed.', ['support_id' => $id, 'error_type' => $exception::class]);

                return 0;
            } finally {
                if ($acquired) {
                    try {
                        $lock->release();
                    } catch (Throwable $exception) {
                        $errors++;
                        Log::warning('Support mail cleanup lock release failed.', ['support_id' => $id, 'error_type' => $exception::class]);
                    }
                }
            }
        };
        $operations = [
            fn (): int => $queues->pruneExpired($now, $withLock),
            fn (): int => $horizon->pruneExpired($now, $withLock),
            function () use ($files, $now, $withLock): int {
                $count = 0;
                foreach ($files->cleanupCandidates($now) as $id) {
                    $count += $withLock($id, function () use ($files, $id, $now): int {
                        if (! $files->canDelete($id, $now)) {
                            return 0;
                        }
                        $files->delete($id);

                        return 1;
                    });
                }

                return $count;
            },
        ];
        foreach ($operations as $operation) {
            try {
                $operation();
            } catch (Throwable $exception) {
                $errors++;
                Log::warning('Support mail cleanup discovery failed.', ['error_type' => $exception::class]);
            }
        }
        $this->line($errors === 0 ? 'Support mail cleanup completed.' : 'Support mail cleanup completed with errors.');

        return $errors === 0 ? self::SUCCESS : self::FAILURE;
    }
}
