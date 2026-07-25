<?php

use Carbon\CarbonImmutable;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->originalDatabaseConnection = config('database.default');
    $this->temporaryDirectory = sys_get_temp_dir().'/pygeoapi-database-backup-tests-'.Str::uuid();
    $this->backupDirectory = $this->temporaryDirectory.'/backups';

    File::ensureDirectoryExists($this->temporaryDirectory);
});

afterEach(function () {
    DB::purge('backup_test');
    config(['database.default' => $this->originalDatabaseConnection]);
    CarbonImmutable::setTestNow();
    File::deleteDirectory($this->temporaryDirectory);
});

test('it creates an sqlite backup selected with prompts', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $database->exec("INSERT INTO examples (name) VALUES ('preserved')");

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    CarbonImmutable::setTestNow('2026-07-25 12:34:56');

    $backupPath = $this->backupDirectory.'/backup_test-2026-07-25_123456.sqlite';

    $this->artisan('db:backup')
        ->expectsChoice(
            'What would you like to do?',
            'backup',
            [
                'backup' => 'Create a backup',
                'restore' => 'Restore a backup',
            ],
        )
        ->expectsPromptsInfo("Database backup created: {$backupPath}")
        ->assertSuccessful();

    expect(File::exists($backupPath))->toBeTrue()
        ->and((new PDO("sqlite:{$backupPath}"))->query('SELECT name FROM examples')->fetchColumn())
        ->toBe('preserved');
});

test('it restores a selected sqlite backup after confirmation', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $database->exec("INSERT INTO examples (name) VALUES ('current')");

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.sqlite';
    $backupPath = $this->backupDirectory.'/'.$backupFileName;
    $backup = new PDO("sqlite:{$backupPath}");
    $backup->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $backup->exec("INSERT INTO examples (name) VALUES ('restored')");

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup')
        ->expectsChoice(
            'What would you like to do?',
            'restore',
            [
                'backup' => 'Create a backup',
                'restore' => 'Restore a backup',
            ],
        )
        ->expectsChoice(
            'Which backup would you like to restore?',
            $backupFileName,
            [$backupFileName => $backupFileName],
        )
        ->expectsConfirmation(
            "Restore [{$backupFileName}]? The current database will be replaced.",
            'yes',
        )
        ->expectsPromptsInfo("Database restored from: {$backupPath}")
        ->assertSuccessful();

    expect((new PDO("sqlite:{$databasePath}"))->query('SELECT name FROM examples')->fetchColumn())
        ->toBe('restored');
});

test('it leaves the sqlite database unchanged when restore is cancelled', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $database->exec("INSERT INTO examples (name) VALUES ('current')");

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.sqlite';
    $backupPath = $this->backupDirectory.'/'.$backupFileName;
    $backup = new PDO("sqlite:{$backupPath}");
    $backup->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $backup->exec("INSERT INTO examples (name) VALUES ('restored')");

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup')
        ->expectsChoice(
            'What would you like to do?',
            'restore',
            [
                'backup' => 'Create a backup',
                'restore' => 'Restore a backup',
            ],
        )
        ->expectsChoice(
            'Which backup would you like to restore?',
            $backupFileName,
            [$backupFileName => $backupFileName],
        )
        ->expectsConfirmation(
            "Restore [{$backupFileName}]? The current database will be replaced.",
            'no',
        )
        ->expectsPromptsInfo('Database restore cancelled.')
        ->assertSuccessful();

    expect((new PDO("sqlite:{$databasePath}"))->query('SELECT name FROM examples')->fetchColumn())
        ->toBe('current');
});

test('it accepts a backup action argument for non-interactive use', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    CarbonImmutable::setTestNow('2026-07-25 12:34:56');

    $backupPath = $this->backupDirectory.'/backup_test-2026-07-25_123456.sqlite';

    $this->artisan('db:backup', ['action' => 'backup'])
        ->expectsPromptsInfo("Database backup created: {$backupPath}")
        ->assertSuccessful();

    expect(File::exists($backupPath))->toBeTrue();
});

test('it rejects an unsupported action argument', function () {
    File::put($this->temporaryDirectory.'/database.sqlite', '');

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $this->temporaryDirectory.'/database.sqlite',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup', ['action' => 'delete'])
        ->expectsPromptsError('Unsupported action [delete]. Use [backup] or [restore].')
        ->assertFailed();

    expect(File::exists($this->backupDirectory))->toBeFalse();
});

test('it restores a named sqlite backup with force for non-interactive use', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $database->exec("INSERT INTO examples (name) VALUES ('current')");

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.sqlite';
    $backupPath = $this->backupDirectory.'/'.$backupFileName;
    $backup = new PDO("sqlite:{$backupPath}");
    $backup->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $backup->exec("INSERT INTO examples (name) VALUES ('restored')");

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup', [
        'action' => 'restore',
        'file' => $backupFileName,
        '--force' => true,
    ])
        ->expectsPromptsInfo("Database restored from: {$backupPath}")
        ->assertSuccessful();

    expect((new PDO("sqlite:{$databasePath}"))->query('SELECT name FROM examples')->fetchColumn())
        ->toBe('restored');
});

test('it fails clearly when there are no backups to restore', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $this->temporaryDirectory.'/database.sqlite',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup')
        ->expectsChoice(
            'What would you like to do?',
            'restore',
            [
                'backup' => 'Create a backup',
                'restore' => 'Restore a backup',
            ],
        )
        ->expectsPromptsError('There are no database backups available to restore.')
        ->assertFailed();
});

test('it creates a postgresql backup with pg dump', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'pgsql',
            'url' => 'postgresql://application_user:secret@postgres.internal:5543/application?sslmode=require',
        ],
    ]);

    CarbonImmutable::setTestNow('2026-07-25 12:34:56');

    $backupPath = $this->backupDirectory.'/backup_test-2026-07-25_123456.dump';

    Process::preventStrayProcesses();
    Process::fake(function (PendingProcess $process) use ($backupPath) {
        File::put($backupPath, 'postgresql custom dump');

        return Process::result();
    });

    $this->artisan('db:backup', ['action' => 'backup'])
        ->expectsPromptsInfo("Database backup created: {$backupPath}")
        ->assertSuccessful();

    expect(File::get($backupPath))->toBe('postgresql custom dump');

    Process::assertRan(fn (PendingProcess $process): bool => $process->command === [
        'pg_dump',
        '--host=postgres.internal',
        '--port=5543',
        '--username=application_user',
        '--dbname=application',
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        "--file={$backupPath}",
    ] && $process->environment === [
        'PGPASSWORD' => 'secret',
        'PGSSLMODE' => 'require',
    ] && $process->timeout === null);
});

test('it creates a mariadb backup with mariadb dump', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'mariadb',
            'host' => 'mariadb',
            'port' => 3306,
            'database' => 'application',
            'username' => 'application_user',
            'password' => 'secret',
            'charset' => 'utf8mb4',
        ],
    ]);

    CarbonImmutable::setTestNow('2026-07-25 12:34:56');

    $backupPath = $this->backupDirectory.'/backup_test-2026-07-25_123456.sql';

    Process::preventStrayProcesses();
    Process::fake(function (PendingProcess $process) use ($backupPath) {
        File::put($backupPath, 'mariadb sql dump');

        return Process::result();
    });

    $this->artisan('db:backup', ['action' => 'backup'])
        ->expectsPromptsInfo("Database backup created: {$backupPath}")
        ->assertSuccessful();

    expect(File::get($backupPath))->toBe('mariadb sql dump');

    Process::assertRan(fn (PendingProcess $process): bool => $process->command === [
        'mariadb-dump',
        '--host=mariadb',
        '--port=3306',
        '--user=application_user',
        '--single-transaction',
        '--quick',
        '--routines',
        '--triggers',
        '--events',
        '--hex-blob',
        '--default-character-set=utf8mb4',
        "--result-file={$backupPath}",
        'application',
    ] && $process->environment === [
        'MYSQL_PWD' => 'secret',
    ] && $process->timeout === null);
});

test('it restores a mariadb backup with the mariadb client', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'mariadb',
            'host' => 'mariadb',
            'port' => 3306,
            'database' => 'application',
            'username' => 'application_user',
            'password' => 'secret',
            'charset' => 'utf8mb4',
        ],
    ]);

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.sql';
    $backupPath = $this->backupDirectory.'/'.$backupFileName;
    $sql = 'CREATE TABLE restored_examples (id BIGINT PRIMARY KEY);';

    File::put($backupPath, $sql);

    $restoredSql = null;

    Process::preventStrayProcesses();
    Process::fake(function (PendingProcess $process) use (&$restoredSql) {
        if (is_resource($process->input)) {
            $restoredSql = stream_get_contents($process->input);
        }

        return Process::result();
    });

    $this->artisan('db:backup', [
        'action' => 'restore',
        'file' => $backupFileName,
        '--force' => true,
    ])
        ->expectsPromptsInfo("Database restored from: {$backupPath}")
        ->assertSuccessful();

    expect($restoredSql)->toBe($sql);

    Process::assertRan(fn (PendingProcess $process): bool => $process->command === [
        'mariadb',
        '--host=mariadb',
        '--port=3306',
        '--user=application_user',
        '--database=application',
        '--default-character-set=utf8mb4',
        '--binary-mode',
    ] && $process->environment === [
        'MYSQL_PWD' => 'secret',
    ] && $process->timeout === null);
});

test('it restores a postgresql backup with pg restore', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'pgsql',
            'host' => 'postgres.internal',
            'port' => 5543,
            'database' => 'application',
            'username' => 'application_user',
            'password' => 'secret',
            'sslmode' => 'require',
        ],
    ]);

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.dump';
    $backupPath = $this->backupDirectory.'/'.$backupFileName;

    File::put($backupPath, 'postgresql custom dump');

    Process::preventStrayProcesses();
    Process::fake();

    $this->artisan('db:backup', [
        'action' => 'restore',
        'file' => $backupFileName,
        '--force' => true,
    ])
        ->expectsPromptsInfo("Database restored from: {$backupPath}")
        ->assertSuccessful();

    Process::assertRan(fn (PendingProcess $process): bool => $process->command === [
        'pg_restore',
        '--host=postgres.internal',
        '--port=5543',
        '--username=application_user',
        '--dbname=application',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '--single-transaction',
        $backupPath,
    ] && $process->environment === [
        'PGPASSWORD' => 'secret',
        'PGSSLMODE' => 'require',
    ] && $process->timeout === null);
});

test('it reports unsupported database drivers without a stack trace', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'mysql',
        ],
    ]);

    $this->artisan('db:backup', ['action' => 'backup'])
        ->expectsPromptsError('Database driver [mysql] is not supported for backups.')
        ->assertFailed();
});

test('it reports a concise postgresql backup process error', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'pgsql',
            'host' => 'postgres.internal',
            'port' => 5543,
            'database' => 'application',
            'username' => 'application_user',
            'password' => 'secret',
            'sslmode' => 'require',
        ],
    ]);

    CarbonImmutable::setTestNow('2026-07-25 12:34:56');

    $backupPath = $this->backupDirectory.'/backup_test-2026-07-25_123456.dump';

    Process::preventStrayProcesses();
    Process::fake(
        function () use ($backupPath): mixed {
            File::put($backupPath, 'partial dump');

            return Process::result(
                errorOutput: 'connection refused',
                exitCode: 1,
            );
        },
    );

    $this->artisan('db:backup', ['action' => 'backup'])
        ->expectsPromptsError('PostgreSQL backup failed: connection refused')
        ->assertFailed();

    expect(File::exists($backupPath))->toBeFalse();
});

test('it reports a concise postgresql restore process error', function () {
    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'pgsql',
            'host' => 'postgres.internal',
            'port' => 5543,
            'database' => 'application',
            'username' => 'application_user',
            'password' => 'secret',
            'sslmode' => 'require',
        ],
    ]);

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.dump';
    File::put($this->backupDirectory.'/'.$backupFileName, 'postgresql custom dump');

    Process::preventStrayProcesses();
    Process::fake(
        fn (): mixed => Process::result(
            errorOutput: 'permission denied',
            exitCode: 1,
        ),
    );

    $this->artisan('db:backup', [
        'action' => 'restore',
        'file' => $backupFileName,
        '--force' => true,
    ])
        ->expectsPromptsError('PostgreSQL restore failed: permission denied')
        ->assertFailed();
});

test('it rejects restore paths outside the backup directory', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $database->exec("INSERT INTO examples (name) VALUES ('current')");

    $outsideBackupFileName = 'backup_test-2026-07-24_120000.sqlite';
    $outsideBackup = new PDO("sqlite:{$this->temporaryDirectory}/{$outsideBackupFileName}");
    $outsideBackup->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $outsideBackup->exec("INSERT INTO examples (name) VALUES ('outside')");

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup', [
        'action' => 'restore',
        'file' => "../{$outsideBackupFileName}",
        '--force' => true,
    ])
        ->expectsPromptsError('The selected database backup is not valid for this connection.')
        ->assertFailed();

    expect((new PDO("sqlite:{$databasePath}"))->query('SELECT name FROM examples')->fetchColumn())
        ->toBe('current');
});

test('it restricts sqlite backup file and directory permissions', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    File::put($databasePath, '');
    File::ensureDirectoryExists($this->backupDirectory, 0777);
    File::chmod($this->backupDirectory, 0777);

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    CarbonImmutable::setTestNow('2026-07-25 12:34:56');

    $backupPath = $this->backupDirectory.'/backup_test-2026-07-25_123456.sqlite';

    $this->artisan('db:backup', ['action' => 'backup'])
        ->assertSuccessful();

    expect(fileperms($this->backupDirectory) & 0777)->toBe(0700)
        ->and(fileperms($backupPath) & 0777)->toBe(0600);
});

test('it does not replace sqlite with a corrupted backup', function () {
    $databasePath = $this->temporaryDirectory.'/database.sqlite';
    $database = new PDO("sqlite:{$databasePath}");
    $database->exec('CREATE TABLE examples (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $database->exec("INSERT INTO examples (name) VALUES ('current')");

    File::ensureDirectoryExists($this->backupDirectory);

    $backupFileName = 'backup_test-2026-07-24_120000.sqlite';
    File::put($this->backupDirectory.'/'.$backupFileName, 'not a sqlite database');

    config([
        'database.default' => 'backup_test',
        'database.backup_path' => $this->backupDirectory,
        'database.connections.backup_test' => [
            'driver' => 'sqlite',
            'database' => $databasePath,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);

    $this->artisan('db:backup', [
        'action' => 'restore',
        'file' => $backupFileName,
        '--force' => true,
    ])
        ->expectsPromptsError('The selected SQLite backup failed its integrity check.')
        ->assertFailed();

    expect((new PDO("sqlite:{$databasePath}"))->query('SELECT name FROM examples')->fetchColumn())
        ->toBe('current');
});
