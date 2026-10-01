<?php

namespace Tests\Integration;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;
use PDO;
use RuntimeException;
use Symfony\Component\Process\InputStream;
use Symfony\Component\Process\Process;
use Throwable;

abstract class SupportIntegrationTestCase extends TestCase
{
    /** @var list<string> */
    private static array $containers = [];

    /** @var array<string,string> */
    protected static array $environment = [];

    private static ?string $temporaryDirectory = null;

    /** @var list<Process> */
    private array $children = [];

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        register_shutdown_function(self::stopInfrastructure(...));
        try {
            $token = bin2hex(random_bytes(6));
            $directory = sys_get_temp_dir().'/support-test-'.$token;
            mkdir($directory, 0700);
            self::$temporaryDirectory = $directory;
            foreach (['app/private', 'app/public', 'framework/cache/data', 'framework/sessions', 'framework/views', 'logs'] as $path) {
                mkdir($directory.'/'.$path, 0700, true);
            }
            $database = 'support_test_'.$token;
            $maria = self::container('mariadb:latest', '3306', [
                '-e', 'MARIADB_ROOT_PASSWORD=synthetic-support-password', '-e', 'MARIADB_DATABASE='.$database,
            ]);
            $redis = self::container('redis:alpine', '6379');
            self::$environment = [
                'SUPPORT_INTEGRATION_ID' => $token, 'APP_ENV' => 'testing', 'APP_DEBUG' => 'false',
                'APP_KEY' => 'base64:'.base64_encode(str_repeat('s', 32)), 'APP_URL' => 'http://127.0.0.1',
                'LARAVEL_STORAGE_PATH' => $directory, 'APP_CONFIG_CACHE' => $directory.'/config.php',
                'DB_CONNECTION' => 'mariadb', 'DB_URL' => '', 'DB_HOST' => '127.0.0.1',
                'DB_PORT' => $maria, 'DB_DATABASE' => $database, 'DB_USERNAME' => 'root',
                'DB_PASSWORD' => 'synthetic-support-password',
                'REDIS_CLIENT' => 'phpredis', 'REDIS_URL' => '', 'REDIS_HOST' => '127.0.0.1',
                'REDIS_PORT' => $redis, 'REDIS_USERNAME' => '', 'REDIS_PASSWORD' => '',
                'REDIS_DB' => '0', 'REDIS_CACHE_DB' => '1', 'REDIS_PREFIX' => $token.':',
                'HORIZON_PREFIX' => $token.':horizon:', 'CACHE_STORE' => 'redis', 'CACHE_PREFIX' => $token.':cache:',
                'QUEUE_CONNECTION' => 'redis', 'REDIS_QUEUE_CONNECTION' => 'default',
                'QUEUE_FAILED_DRIVER' => 'database-uuids', 'SESSION_DRIVER' => 'array',
                'MAIL_MAILER' => 'array', 'MAIL_FROM_ADDRESS' => 'support@example.org',
                'LOG_CHANNEL' => 'null', 'BROADCAST_CONNECTION' => 'null', 'SUPPORT_ALLOW_GUESTS' => 'false',
            ];
            $deadline = microtime(true) + 40;
            do {
                try {
                    new PDO('mysql:host=127.0.0.1;port='.$maria.';dbname='.$database, 'root', 'synthetic-support-password');
                    break;
                } catch (Throwable $exception) {
                    if (microtime(true) >= $deadline) {
                        throw new RuntimeException('Isolated MariaDB did not become ready.', previous: $exception);
                    }
                    usleep(100000);
                }
            } while (true);
        } catch (Throwable $exception) {
            self::stopInfrastructure();
            throw new RuntimeException('Support integration requires Docker, pdo_mysql and phpredis; no application services are used.', previous: $exception);
        }
    }

    /** @param list<string> $options */
    private static function container(string $image, string $port, array $options = []): string
    {
        $process = new Process([
            'docker', 'run', '--detach', '--rm', '--name', 'support-test-'.bin2hex(random_bytes(6)),
            '--publish', '127.0.0.1::'.$port, ...$options, $image,
        ], timeout: 60);
        $process->mustRun();
        $id = trim($process->getOutput());
        if (! preg_match('/^[a-f0-9]{64}$/', $id)) {
            throw new RuntimeException('Docker returned an invalid container id.');
        }
        self::$containers[] = $id;
        $mapping = new Process(['docker', 'port', $id, $port.'/tcp'], timeout: 10);
        $mapping->mustRun();
        if (! preg_match('/^127\.0\.0\.1:(\d+)$/', trim($mapping->getOutput()), $match)) {
            throw new RuntimeException('Test container must bind only to loopback.');
        }

        return $match[1];
    }

    public function createApplication(): Application
    {
        foreach (self::$environment as $key => $value) {
            putenv($key.'='.$value);
            $_ENV[$key] = $_SERVER[$key] = $value;
        }

        return self::bootIsolatedApplication();
    }

    public static function bootIsolatedApplication(): Application
    {
        $token = getenv('SUPPORT_INTEGRATION_ID');
        $directory = sys_get_temp_dir().'/support-test-'.$token;
        if (! is_string($token) || ! preg_match('/^[a-f0-9]{12}$/', $token)
            || getenv('APP_ENV') !== 'testing' || getenv('DB_DATABASE') !== 'support_test_'.$token
            || getenv('DB_HOST') !== '127.0.0.1' || getenv('REDIS_HOST') !== '127.0.0.1'
            || getenv('DB_URL') !== '' || getenv('REDIS_URL') !== ''
            || getenv('LARAVEL_STORAGE_PATH') !== $directory || ! is_dir($directory)) {
            throw new RuntimeException('Refusing to bootstrap outside the isolated support test environment.');
        }
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->useEnvironmentPath($directory)->loadEnvironmentFrom('absent.env');
        $app->make(Kernel::class)->bootstrap();
        if (! $app->environment('testing') || config('database.default') !== 'mariadb'
            || config('database.connections.mariadb.database') !== 'support_test_'.$token
            || config('database.connections.mariadb.host') !== '127.0.0.1'
            || (string) config('database.connections.mariadb.port') !== getenv('DB_PORT')
            || filled(config('database.connections.mariadb.url'))
            || config('database.redis.default.host') !== '127.0.0.1'
            || (string) config('database.redis.default.port') !== getenv('REDIS_PORT')
            || filled(config('database.redis.default.url'))
            || config('filesystems.disks.local.root') !== $directory.'/app/private') {
            throw new RuntimeException('Refusing to migrate or connect to non-test services.');
        }

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Artisan::call('migrate:fresh', ['--force' => true]);
        Redis::connection('default')->flushdb();
        Redis::connection('cache')->flushdb();
        (new Filesystem)->deleteDirectory(storage_path('app/private/support-mail'));
    }

    /** @param list<string> $arguments */
    protected function fixture(array $arguments, ?InputStream $input = null): Process
    {
        $process = new Process([PHP_BINARY, __DIR__.'/fixtures/support-process.php', ...$arguments], base_path(), self::$environment, timeout: 20);
        if ($input !== null) {
            $process->setInput($input);
        }
        $this->children[] = $process;
        $process->start();

        return $process;
    }

    protected function waitForSignal(Process $process, string $signal): void
    {
        $this->assertTrue($process->waitUntil(fn (): bool => str_contains($process->getOutput(), $signal)), $process->getOutput().$process->getErrorOutput());
    }

    protected function tearDown(): void
    {
        foreach ($this->children as $child) {
            if ($child->isRunning()) {
                $child->stop(1);
            }
        }
        parent::tearDown();
    }

    public static function tearDownAfterClass(): void
    {
        self::stopInfrastructure();
        parent::tearDownAfterClass();
    }

    public static function stopInfrastructure(): void
    {
        foreach (self::$containers as $id) {
            (new Process(['docker', 'rm', '--force', $id], timeout: 15))->run();
        }
        self::$containers = [];
        if (self::$temporaryDirectory !== null) {
            (new Filesystem)->deleteDirectory(self::$temporaryDirectory);
            self::$temporaryDirectory = null;
        }
    }
}
