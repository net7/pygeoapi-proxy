<?php

use App\Actions\Admin\DeleteUser;
use App\Models\User;
use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportContactManager;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Tests\Integration\SupportIntegrationTestCase;

require dirname(__DIR__, 3).'/vendor/autoload.php';

SupportIntegrationTestCase::bootIsolatedApplication();
Http::preventStrayRequests();
Http::fake();
$action = $argv[1];
$id = $argv[2] ?? '';

if ($action === 'hold-lock') {
    $lock = Cache::lock('support-mail:'.$id, 75);
    if (! $lock->get()) {
        throw new RuntimeException('Could not acquire test worker lock.');
    }
    try {
        fwrite(STDOUT, "LOCKED\n");
        fflush(STDOUT);
        fgets(STDIN);
    } finally {
        $lock->release();
    }
    exit(0);
}

if ($action === 'work-once') {
    config(['mail.mailers.integration' => ['transport' => 'integration'], 'mail.default' => 'integration']);
    Mail::extend('integration', fn () => new class($id) extends AbstractTransport
    {
        public function __construct(private string $behavior)
        {
            parent::__construct();
        }

        protected function doSend(SentMessage $message): void
        {
            Redis::incr('support-test:transport-attempts');
            if ($this->behavior === 'fail') {
                throw new RuntimeException('Synthetic SMTP failure.');
            }
        }

        public function __toString(): string
        {
            return 'integration://synthetic';
        }
    });
    if ($id === 'cleanup-fails') {
        app()->bind(SupportAttachments::class, fn () => new class extends SupportAttachments
        {
            public function delete(string $id): void
            {
                throw new RuntimeException('Synthetic cleanup failure.');
            }
        });
    }
    exit(Artisan::call('queue:work', [
        'connection' => 'redis', '--once' => true, '--queue' => 'support-mail',
        '--tries' => 1, '--timeout' => 60, '--sleep' => 0,
    ]));
}

$held = ($argv[3] ?? '') === 'hold';
if ($held) {
    DB::beginTransaction();
    DB::table('support_settings')->where('id', 1)->lockForUpdate()->first();
    fwrite(STDOUT, "LOCKED\n");
    fflush(STDOUT);
    fgets(STDIN);
}
fwrite(STDOUT, "ATTEMPTING\n");
fflush(STDOUT);
try {
    $contacts = app(SupportContactManager::class);
    if ($action === 'assign') {
        $contacts->assign((int) $id);
    } elseif ($action === 'delete') {
        app(DeleteUser::class)->handle(User::findOrFail($id));
    } else {
        $contacts->guardAccountChange([(int) $id], 'user', function () use ($action, $id): void {
            User::findOrFail($id)->update(match ($action) {
                'deactivate' => ['deactivated_at' => now()],
                'demote' => ['role' => 'user'],
                default => throw new RuntimeException('Unknown fixture action.'),
            });
        });
    }
    if ($held) {
        DB::commit();
    }
    fwrite(STDOUT, "RESULT:OK\n");
} catch (ValidationException) {
    if ($held) {
        DB::rollBack();
    }
    fwrite(STDOUT, "RESULT:REJECTED\n");
}
