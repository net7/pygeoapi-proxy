<?php

namespace Tests\Integration;

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportContactManager;
use App\Support\SupportMailData;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Horizon\Contracts\JobRepository;
use Laravel\Horizon\JobPayload;
use RuntimeException;
use Symfony\Component\Process\InputStream;

class SupportQueueRuntimeTest extends SupportIntegrationTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    }

    public function test_a_real_worker_honors_three_attempts_and_backoff_despite_tries_one(): void
    {
        Queue::pushOn('support-mail', $this->job());
        $redis = Redis::connection();
        foreach ([60, 300, null] as $index => $delay) {
            $before = time();
            $this->work('fail');
            $this->assertSame($index + 1, (int) $redis->get('support-test:transport-attempts'));
            $delayed = $redis->zrange('queues:support-mail:delayed', 0, -1);
            if ($delay !== null) {
                $this->assertCount(1, $delayed);
                $score = (int) $redis->zscore('queues:support-mail:delayed', $delayed[0]);
                $this->assertGreaterThanOrEqual($before + $delay, $score);
                $this->assertLessThanOrEqual(time() + $delay, $score);
                $redis->zadd('queues:support-mail:delayed', time() - 1, $delayed[0]);
            } else {
                $this->assertSame([], $delayed);
            }
        }
        $this->assertSame(1, DB::table('failed_jobs')->where('queue', 'support-mail')->count());
        $this->work('fail');
        $this->assertSame(3, (int) $redis->get('support-test:transport-attempts'));
    }

    public function test_cleanup_prunes_real_redis_pages_failed_jobs_and_horizon_without_touching_other_jobs(): void
    {
        $redis = Redis::connection();
        $horizon = Redis::connection('horizon');
        $repository = app(JobRepository::class);
        $expired = [];
        foreach (['pending' => 101, 'delayed' => 1, 'reserved' => 1, 'failed' => 1] as $state => $count) {
            for ($i = 0; $i < $count; $i++) {
                $job = $this->job(expired: true);
                $raw = $this->payload($job);
                $payload = new JobPayload($raw);
                $repository->pushed('redis', 'support-mail', $payload);
                if ($state === 'pending') {
                    $redis->rpush('queues:support-mail', $raw);
                } elseif ($state === 'failed') {
                    $exception = new RuntimeException('Synthetic failed support request.');
                    app('queue.failer')->log('redis', 'support-mail', $raw, $exception);
                    $repository->failed($exception, 'redis', 'support-mail', $payload);
                } else {
                    $redis->zadd('queues:support-mail:'.$state, time() + 60, $raw);
                    if ($state === 'reserved') {
                        $repository->reserved('redis', 'support-mail', $payload);
                    }
                }
                $expired[] = [$payload->id(), $job->data->id];
            }
        }
        $recent = $this->job();
        $recentRaw = $this->payload($recent);
        $recentPayload = new JobPayload($recentRaw);
        $repository->pushed('redis', 'support-mail', $recentPayload);
        $redis->rpush('queues:support-mail', $recentRaw);
        $foreign = json_decode($recentRaw, true, flags: JSON_THROW_ON_ERROR);
        $foreign['uuid'] = (string) Str::uuid();
        $foreign['displayName'] = 'Synthetic OGC job';
        $foreign['data'] = ['commandName' => 'App\\Jobs\\SyntheticOgcJob', 'command' => 'synthetic'];
        $foreign['support_mail']['expires_at'] = time() - 1;
        $foreignRaw = json_encode($foreign, JSON_THROW_ON_ERROR);
        $foreignPayload = new JobPayload($foreignRaw);
        $redis->rpush('queues:support-mail', $foreignRaw);
        $repository->pushed('redis', 'support-mail', $foreignPayload);
        $repository->failed(new RuntimeException('Synthetic OGC failure.'), 'redis', 'support-mail', $foreignPayload);
        app('queue.failer')->log('redis', 'support-mail', $foreignRaw, new RuntimeException('Synthetic OGC failure.'));
        Storage::disk('local')->put('unrelated/keep.txt', 'unrelated');

        $this->assertSame(0, Artisan::call('support:prune'), Artisan::output());
        $this->assertSame([$recentRaw, $foreignRaw], $redis->lrange('queues:support-mail', 0, -1));
        $this->assertSame(0, $redis->zcard('queues:support-mail:delayed'));
        $this->assertSame(0, $redis->zcard('queues:support-mail:reserved'));
        $this->assertSame([$foreignRaw], DB::table('failed_jobs')->pluck('payload')->all());
        foreach ($expired as [$horizonId, $requestId]) {
            $this->assertSame([], $horizon->hgetall($horizonId));
            Storage::disk('local')->assertMissing('support-mail/'.$requestId.'/manifest.json');
            foreach (['recent_jobs', 'pending_jobs', 'failed_jobs', 'recent_failed_jobs'] as $index) {
                $this->assertNotContains($horizonId, $horizon->zrange($index, 0, -1));
            }
        }
        $this->assertNotEmpty($horizon->hgetall($recentPayload->id()));
        $this->assertNotEmpty($horizon->hgetall($foreignPayload->id()));
        Storage::disk('local')->assertExists('support-mail/'.$recent->data->id.'/manifest.json');
        Storage::disk('local')->assertExists('unrelated/keep.txt');
    }

    public function test_cleanup_respects_a_worker_lock_held_in_another_process(): void
    {
        $job = $this->job(expired: true);
        $raw = $this->payload($job);
        $payload = new JobPayload($raw);
        Redis::zadd('queues:support-mail:reserved', time() + 60, $raw);
        app(JobRepository::class)->pushed('redis', 'support-mail', $payload);
        app(JobRepository::class)->reserved('redis', 'support-mail', $payload);
        $input = new InputStream;
        $worker = $this->fixture(['hold-lock', $job->data->id], $input);
        $this->waitForSignal($worker, 'LOCKED');
        $this->assertSame(0, Artisan::call('support:prune'));
        Storage::disk('local')->assertExists('support-mail/'.$job->data->id.'/manifest.json');
        $this->assertSame([$raw], Redis::zrange('queues:support-mail:reserved', 0, -1));
        $this->assertNotEmpty(Redis::connection('horizon')->hgetall($payload->id()));
        $input->write("release\n");
        $input->close();
        $this->assertSame(0, $worker->wait(), $worker->getErrorOutput());
        $this->assertSame(0, Artisan::call('support:prune'));
        Storage::disk('local')->assertMissing('support-mail/'.$job->data->id.'/manifest.json');
        $this->assertSame([], Redis::zrange('queues:support-mail:reserved', 0, -1));
        $this->assertSame([], Redis::connection('horizon')->hgetall($payload->id()));
    }

    public function test_an_expired_job_never_calls_the_transport_even_when_retried(): void
    {
        Queue::pushOn('support-mail', $this->job(expired: true));
        $this->work('success');
        $this->assertSame(0, (int) Redis::get('support-test:transport-attempts'));
        $failed = DB::table('failed_jobs')->first();
        $this->assertNotNull($failed);
        Artisan::call('queue:retry', ['id' => [$failed->uuid]]);
        $this->work('success');
        $this->assertSame(0, (int) Redis::get('support-test:transport-attempts'));
    }

    public function test_cleanup_failure_after_delivery_does_not_resend_and_scheduler_removes_files(): void
    {
        $job = $this->job();
        Queue::pushOn('support-mail', $job);
        $this->work('cleanup-fails');
        $this->assertSame(1, (int) Redis::get('support-test:transport-attempts'));
        $this->assertTrue(app(SupportAttachments::class)->isDelivered($job->data->id));
        Queue::pushOn('support-mail', $job);
        $this->work('cleanup-fails');
        $this->assertSame(1, (int) Redis::get('support-test:transport-attempts'));
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertSame(0, Artisan::call('support:prune'));
        Storage::disk('local')->assertMissing('support-mail/'.$job->data->id.'/manifest.json');
    }

    private function job(bool $expired = false): SendSupportEmail
    {
        $id = (string) Str::uuid();
        $accepted = time() - ($expired ? 604801 : 0);
        app(SupportAttachments::class)->store($id, $accepted, $accepted + 604800, []);

        return new SendSupportEmail(new SupportMailData(
            id: $id, subject: 'Synthetic integration request', description: 'Synthetic diagnostic',
            replyTo: 'reply@example.org', acceptedAt: $accepted, expiresAt: $accepted + 604800,
            account: null, attachments: [],
        ));
    }

    private function payload(SendSupportEmail $job): string
    {
        Queue::pushOn('support-mail', $job);

        return Redis::rpop('queues:support-mail');
    }

    private function work(string $behavior): void
    {
        $worker = $this->fixture(['work-once', $behavior]);
        $this->assertSame(0, $worker->wait(), $worker->getOutput().$worker->getErrorOutput());
    }
}
