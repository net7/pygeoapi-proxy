<?php

use App\Jobs\SendSupportEmail;
use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportHorizonPruner;
use App\Services\Support\SupportQueuePruner;
use Illuminate\Redis\Connections\Connection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    config(['queue.default' => 'database']);
});

function prunableSupportPayload(string $id, int $expiresAt, string $class = SendSupportEmail::class): string
{
    return json_encode([
        'uuid' => (string) Str::uuid(),
        'data' => ['commandName' => $class, 'command' => 'encrypted-test-data'],
        'support_mail' => ['id' => $id, 'expires_at' => $expiresAt],
    ], JSON_THROW_ON_ERROR);
}

test('cleanup skips requests locked by a worker and leaves unrelated data intact', function () {
    Storage::fake('local');
    $id = (string) Str::uuid();
    $files = app(SupportAttachments::class);
    $files->store($id, now()->subDays(8)->timestamp, now()->subDay()->timestamp, []);
    Storage::disk('local')->put('ogc/keep.txt', 'keep');
    $jobId = DB::table('jobs')->insertGetId([
        'queue' => 'support-mail', 'payload' => prunableSupportPayload($id, now()->subDay()->timestamp),
        'attempts' => 1, 'reserved_at' => now()->timestamp, 'available_at' => now()->timestamp,
        'created_at' => now()->subDays(8)->timestamp,
    ]);
    $lock = Cache::lock('support-mail:'.$id, 75);
    expect($lock->get())->toBeTrue();
    try {
        $this->artisan('support:prune')->assertSuccessful();
        Storage::disk('local')->assertExists("support-mail/{$id}/manifest.json");
        $this->assertDatabaseHas('jobs', ['id' => $jobId]);
    } finally {
        $lock->release();
    }
    $this->artisan('support:prune')->assertSuccessful();
    Storage::disk('local')->assertMissing("support-mail/{$id}/manifest.json");
    Storage::disk('local')->assertExists('ogc/keep.txt');
    $this->assertDatabaseMissing('jobs', ['id' => $jobId]);
});

test('cleanup removes expired database jobs in every state but keeps other queues and jobs', function () {
    Storage::fake('local');
    $this->freezeTime();
    foreach (['pending', 'delayed', 'reserved'] as $state) {
        DB::table('jobs')->insert([
            'queue' => 'support-mail',
            'payload' => prunableSupportPayload((string) Str::uuid(), now()->timestamp),
            'attempts' => 0,
            'reserved_at' => $state === 'reserved' ? now()->timestamp : null,
            'available_at' => $state === 'delayed' ? now()->addHour()->timestamp : now()->timestamp,
            'created_at' => now()->subDays(7)->timestamp,
        ]);
    }
    $keep = [];
    foreach ([
        ['support-mail', SendSupportEmail::class, now()->addDay()->timestamp],
        ['default', SendSupportEmail::class, now()->subDay()->timestamp],
        ['support-mail', 'App\\Jobs\\OtherJob', now()->subDay()->timestamp],
    ] as [$queue, $class, $expiry]) {
        $keep[] = DB::table('jobs')->insertGetId([
            'queue' => $queue, 'payload' => prunableSupportPayload((string) Str::uuid(), $expiry, $class),
            'attempts' => 0, 'reserved_at' => null, 'available_at' => now()->timestamp,
            'created_at' => now()->timestamp,
        ]);
    }
    $this->artisan('support:prune')->assertSuccessful();
    expect(DB::table('jobs')->orderBy('id')->pluck('id')->all())->toBe($keep);
});

test('recent failure timestamps do not extend the original support retention deadline', function () {
    Storage::fake('local');
    $expired = (string) Str::uuid();
    $recent = (string) Str::uuid();
    foreach ([$expired => now()->subDay()->timestamp, $recent => now()->addDay()->timestamp] as $uuid => $expiry) {
        DB::table('failed_jobs')->insert([
            'uuid' => $uuid, 'connection' => 'database', 'queue' => 'support-mail',
            'payload' => prunableSupportPayload((string) Str::uuid(), $expiry),
            'exception' => 'Synthetic failure', 'failed_at' => now(),
        ]);
    }
    $this->artisan('support:prune')->assertSuccessful();
    $this->assertDatabaseMissing('failed_jobs', ['uuid' => $expired]);
    $this->assertDatabaseHas('failed_jobs', ['uuid' => $recent]);
});

test('old orphan directories are removed but fresh corrupt metadata is preserved', function () {
    $disk = Storage::fake('local');
    $old = (string) Str::uuid();
    $fresh = (string) Str::uuid();
    $disk->put("support-mail/{$old}/orphan.bin", 'orphan');
    $disk->put("support-mail/{$fresh}/manifest.json", 'broken JSON');
    touch($disk->path("support-mail/{$old}/orphan.bin"), now()->subDays(8)->timestamp);
    clearstatcache();
    $this->artisan('support:prune')->assertSuccessful();
    $disk->assertMissing("support-mail/{$old}/orphan.bin");
    $disk->assertExists("support-mail/{$fresh}/manifest.json");
});

test('cleanup does not follow symbolic links outside its request directory', function () {
    $disk = Storage::fake('local');
    $disk->put('other-data/keep.txt', 'keep');
    $disk->makeDirectory('support-mail');
    $id = (string) Str::uuid();
    symlink($disk->path('other-data'), $disk->path('support-mail/'.$id));
    try {
        expect(app(SupportAttachments::class)->canDelete($id, now()->addDays(8)->timestamp))->toBeFalse();
        $this->artisan('support:prune')->assertSuccessful();
        $disk->assertExists('other-data/keep.txt');
    } finally {
        unlink($disk->path('support-mail/'.$id));
    }
});

test('one storage failure is reported without preventing other expired requests from being cleaned', function () {
    $disk = Storage::fake('local');
    $files = app(SupportAttachments::class);
    $failed = (string) Str::uuid();
    $removed = (string) Str::uuid();
    foreach ([$failed, $removed] as $id) {
        $files->store($id, now()->subDays(8)->timestamp, now()->subDay()->timestamp, []);
    }
    $this->partialMock(SupportAttachments::class, function ($mock) use ($files, $failed): void {
        $mock->shouldReceive('delete')->andReturnUsing(function (string $id) use ($files, $failed): void {
            if ($id === $failed) {
                throw new RuntimeException('Synthetic delete failure');
            }
            $files->delete($id);
        });
    });
    $this->artisan('support:prune')->assertFailed();
    $disk->assertExists("support-mail/{$failed}/manifest.json");
    $disk->assertMissing("support-mail/{$removed}/manifest.json");
});

test('redis pruning removes only matching expired payloads from all queue states', function () {
    config(['queue.default' => 'redis']);
    $expired = prunableSupportPayload((string) Str::uuid(), now()->subDay()->timestamp);
    $recent = prunableSupportPayload((string) Str::uuid(), now()->addDay()->timestamp);
    $other = prunableSupportPayload((string) Str::uuid(), now()->subDay()->timestamp, 'OtherJob');
    $lists = [
        'queues:support-mail' => [$expired, $recent],
        'queues:support-mail:delayed' => [$expired, $other],
        'queues:support-mail:reserved' => [$expired],
    ];
    $connection = Mockery::mock(Connection::class);
    $connection->shouldReceive('isCluster')->andReturn(false);
    foreach (['lrange', 'zrange'] as $method) {
        $connection->shouldReceive($method)->andReturnUsing(
            function (string $key, int $start, int $end) use (&$lists): array {
                return array_slice($lists[$key], $start, $end - $start + 1);
            },
        );
    }
    $remove = function (string $key, string $payload) use (&$lists): int {
        $before = count($lists[$key]);
        $lists[$key] = array_values(array_filter($lists[$key], fn ($value): bool => $value !== $payload));

        return $before - count($lists[$key]);
    };
    $connection->shouldReceive('lrem')->andReturnUsing(fn ($key, $count, $payload): int => $remove($key, $payload));
    $connection->shouldReceive('zrem')->andReturnUsing($remove);
    Redis::shouldReceive('connection')->with('default')->andReturn($connection);
    $count = app(SupportQueuePruner::class)->pruneExpired(now()->timestamp, fn ($id, Closure $operation): int => $operation());
    expect($count)->toBe(3);
    expect($lists)->toBe([
        'queues:support-mail' => [$recent],
        'queues:support-mail:delayed' => [$other],
        'queues:support-mail:reserved' => [],
    ]);
});

test('horizon pruning targets every index but only hashes with expired support metadata', function () {
    config(['queue.default' => 'redis']);
    $requestId = (string) Str::uuid();
    $expired = prunableSupportPayload($requestId, now()->subDay()->timestamp);
    $recent = prunableSupportPayload((string) Str::uuid(), now()->addDay()->timestamp);
    $removed = false;
    $connection = Mockery::mock(Connection::class);
    $indices = ['recent_jobs', 'pending_jobs', 'completed_jobs', 'silenced_jobs', 'failed_jobs', 'recent_failed_jobs', 'monitored_jobs'];
    foreach ($indices as $index) {
        $connection->shouldReceive('zrange')->with($index, 0, 99)->once()
            ->andReturnUsing(function () use (&$removed): array {
                return $removed ? ['recent'] : ['expired', 'recent'];
            });
    }
    $connection->shouldReceive('hgetall')->with('expired')->once()->andReturn(['queue' => 'support-mail', 'payload' => $expired]);
    $connection->shouldReceive('hgetall')->with('recent')->andReturn(['queue' => 'support-mail', 'payload' => $recent]);
    $connection->shouldReceive('eval')->once()->withArgs(function ($lua, $numKeys, ...$args) use ($indices, $expired): bool {
        return str_contains($lua, "redis.call('del'") && $numKeys === 8
            && $args === ['expired', ...$indices, $expired, 'support-mail', 'expired'];
    })->andReturnUsing(function () use (&$removed): int {
        $removed = true;

        return 1;
    });
    Redis::shouldReceive('connection')->with('horizon')->andReturn($connection);
    $lockedIds = [];
    $count = app(SupportHorizonPruner::class)->pruneExpired(now()->timestamp, function ($id, Closure $operation) use (&$lockedIds): int {
        $lockedIds[] = $id;

        return $operation();
    });
    expect($count)->toBe(1);
    expect($lockedIds)->toBe([$requestId]);
});
