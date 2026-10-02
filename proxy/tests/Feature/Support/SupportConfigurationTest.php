<?php

use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

test('support runtime queues and timeouts leave room for a bounded mail attempt', function () {
    expect(config('horizon.defaults.supervisor-1.queue'))->toContain('default', 'support-mail');
    expect(config('support.max_attachments'))->toBe(3);
    expect(config('support.max_file_kib'))->toBe(5120);
    expect(config('mail.mailers.smtp.timeout'))->toBeLessThan(45);
    expect(config('horizon.defaults.supervisor-1.timeout'))->toBeGreaterThan(45);
    expect(config('support.lock_seconds'))->toBeGreaterThan(60)->toBeLessThan(90);
    foreach (['redis', 'database'] as $driver) {
        expect(config('queue.connections.'.$driver.'.retry_after'))->toBeGreaterThanOrEqual(90);
    }
    $composer = json_decode(file_get_contents(base_path('composer.json')), true, flags: JSON_THROW_ON_ERROR);
    expect(implode(' ', $composer['scripts']['dev']))
        ->toContain('queue:work --queue=support-mail --tries=3 --timeout=60')
        ->toContain('queue:listen --queue=default');
});

test('guest access is read from the cached configuration rather than the runtime environment', function (string $value, bool $allowed) {
    $path = sys_get_temp_dir().'/support-config-'.Str::uuid().'.php';
    $environment = [
        'APP_ENV' => 'testing', 'APP_CONFIG_CACHE' => $path,
        'APP_KEY' => 'base64:U3VwcG9ydE1haWxUZXN0S2V5MDEyMzQ1Njc4OTAxMjM=',
        'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:', 'DB_URL' => '',
        'CACHE_STORE' => 'array', 'QUEUE_CONNECTION' => 'database', 'MAIL_MAILER' => 'array',
        'SUPPORT_ALLOW_GUESTS' => $value,
    ];
    try {
        $cache = new Process([PHP_BINARY, 'artisan', 'config:cache', '--no-interaction'], base_path(), $environment);
        $cache->mustRun();
        $probe = new Process([PHP_BINARY, '-r',
            'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); echo json_encode(config("support.allow_guests"));',
        ], base_path(), [...$environment, 'SUPPORT_ALLOW_GUESTS' => $allowed ? 'false' : 'true']);
        $probe->mustRun();
        expect(json_decode($probe->getOutput(), true, flags: JSON_THROW_ON_ERROR))->toBe($allowed);
    } finally {
        if (is_file($path)) {
            unlink($path);
        }
    }
})->with([['0', false], ['1', true]]);
