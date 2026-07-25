<?php

namespace App\Services;

use Illuminate\Filesystem\Filesystem;
use Illuminate\Process\Exceptions\ProcessFailedException;
use Illuminate\Support\ConfigurationUrlParser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use PDO;
use PDOException;
use RuntimeException;

class DatabaseBackupManager
{
    public function __construct(private Filesystem $files) {}

    public function backup(): string
    {
        $connectionName = $this->connectionName();
        $connection = $this->connectionConfiguration($connectionName);
        $driver = $connection['driver'] ?? null;

        $backupDirectory = $this->backupDirectory();
        $extension = $this->extensionForDriver($driver);
        $backupPath = $backupDirectory.'/'.$this->backupFileName($connectionName, $extension);

        if ($this->files->exists($backupPath)) {
            throw new RuntimeException("The database backup [{$backupPath}] already exists.");
        }

        $this->files->ensureDirectoryExists($backupDirectory, 0700);
        $this->files->chmod($backupDirectory, 0700);

        match ($driver) {
            'sqlite' => $this->backupSqlite($connectionName, $connection, $backupPath),
            'mariadb' => $this->backupMariaDb($connection, $backupPath),
            'pgsql' => $this->backupPostgresql($connection, $backupPath),
        };

        $this->files->chmod($backupPath, 0600);

        return $backupPath;
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function backupSqlite(string $connectionName, array $connection, string $backupPath): void
    {
        $this->sqliteDatabasePath($connection);

        $pdo = DB::connection($connectionName)->getPdo();

        if (! $pdo instanceof PDO) {
            throw new RuntimeException('The SQLite connection did not provide a PDO instance.');
        }

        $quotedBackupPath = $pdo->quote($backupPath);

        if ($quotedBackupPath === false) {
            throw new RuntimeException('Unable to prepare the SQLite backup path.');
        }

        $pdo->exec("VACUUM INTO {$quotedBackupPath}");
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function backupPostgresql(array $connection, string $backupPath): void
    {
        try {
            $this->runPostgresqlProcess(
                connection: $connection,
                command: [
                    'pg_dump',
                    '--host='.$this->requiredConnectionValue($connection, 'host'),
                    '--port='.$this->requiredConnectionValue($connection, 'port'),
                    '--username='.$this->requiredConnectionValue($connection, 'username'),
                    '--dbname='.$this->requiredConnectionValue($connection, 'database'),
                    '--format=custom',
                    '--no-owner',
                    '--no-privileges',
                    "--file={$backupPath}",
                ],
                operation: 'backup',
            );
        } catch (RuntimeException $exception) {
            $this->files->delete($backupPath);

            throw $exception;
        }

        if (! $this->files->isFile($backupPath)) {
            throw new RuntimeException('PostgreSQL backup completed without creating a dump file.');
        }
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function backupMariaDb(array $connection, string $backupPath): void
    {
        try {
            $this->runMariaDbProcess(
                connection: $connection,
                command: [
                    'mariadb-dump',
                    '--host='.$this->requiredConnectionValue($connection, 'host', 'MariaDB'),
                    '--port='.$this->requiredConnectionValue($connection, 'port', 'MariaDB'),
                    '--user='.$this->requiredConnectionValue($connection, 'username', 'MariaDB'),
                    '--single-transaction',
                    '--quick',
                    '--routines',
                    '--triggers',
                    '--events',
                    '--hex-blob',
                    '--default-character-set='.$this->requiredConnectionValue($connection, 'charset', 'MariaDB'),
                    "--result-file={$backupPath}",
                    $this->requiredConnectionValue($connection, 'database', 'MariaDB'),
                ],
                operation: 'backup',
            );
        } catch (RuntimeException $exception) {
            $this->files->delete($backupPath);

            throw $exception;
        }

        if (! $this->files->isFile($backupPath)) {
            throw new RuntimeException('MariaDB backup completed without creating a dump file.');
        }
    }

    /**
     * @return array<string, string>
     */
    public function availableBackups(): array
    {
        $connectionName = $this->connectionName();
        $connection = $this->connectionConfiguration($connectionName);
        $extension = $this->extensionForDriver($connection['driver'] ?? null);

        $backupDirectory = $this->backupDirectory();
        $safeConnectionName = $this->safeConnectionName($connectionName);
        $paths = $this->files->glob("{$backupDirectory}/{$safeConnectionName}-*.{$extension}");

        rsort($paths, SORT_STRING);

        return collect($paths)
            ->mapWithKeys(fn (string $path): array => [basename($path) => basename($path)])
            ->all();
    }

    public function restore(string $backupFileName): string
    {
        $connectionName = $this->connectionName();
        $connection = $this->connectionConfiguration($connectionName);
        $driver = $connection['driver'] ?? null;
        $extension = $this->extensionForDriver($driver);
        $backupPath = $this->resolveBackupPath($connectionName, $backupFileName, $extension);

        match ($driver) {
            'sqlite' => $this->restoreSqlite($connectionName, $connection, $backupPath),
            'mariadb' => $this->restoreMariaDb($connectionName, $connection, $backupPath),
            'pgsql' => $this->restorePostgresql($connectionName, $connection, $backupPath),
        };

        return $backupPath;
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function restoreSqlite(string $connectionName, array $connection, string $backupPath): void
    {
        $this->ensureSqliteBackupIntegrity($backupPath);

        $databasePath = $this->sqliteDatabasePath($connection);
        $temporaryPath = $databasePath.'.restore-'.Str::random(12);

        try {
            if (! $this->files->copy($backupPath, $temporaryPath)) {
                throw new RuntimeException('Unable to prepare the SQLite database restore.');
            }

            $this->files->chmod($temporaryPath, 0600);

            DB::purge($connectionName);
            $this->files->delete([$databasePath.'-wal', $databasePath.'-shm']);

            if (! $this->files->move($temporaryPath, $databasePath)) {
                throw new RuntimeException('Unable to replace the SQLite database.');
            }
        } finally {
            $this->files->delete($temporaryPath);
        }
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function restorePostgresql(string $connectionName, array $connection, string $backupPath): void
    {
        DB::purge($connectionName);

        $this->runPostgresqlProcess(
            connection: $connection,
            command: [
                'pg_restore',
                '--host='.$this->requiredConnectionValue($connection, 'host'),
                '--port='.$this->requiredConnectionValue($connection, 'port'),
                '--username='.$this->requiredConnectionValue($connection, 'username'),
                '--dbname='.$this->requiredConnectionValue($connection, 'database'),
                '--clean',
                '--if-exists',
                '--no-owner',
                '--no-privileges',
                '--exit-on-error',
                '--single-transaction',
                $backupPath,
            ],
            operation: 'restore',
        );
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function restoreMariaDb(string $connectionName, array $connection, string $backupPath): void
    {
        $backupStream = fopen($backupPath, 'rb');

        if ($backupStream === false) {
            throw new RuntimeException('Unable to read the selected MariaDB backup.');
        }

        try {
            DB::purge($connectionName);

            $this->runMariaDbProcess(
                connection: $connection,
                command: [
                    'mariadb',
                    '--host='.$this->requiredConnectionValue($connection, 'host', 'MariaDB'),
                    '--port='.$this->requiredConnectionValue($connection, 'port', 'MariaDB'),
                    '--user='.$this->requiredConnectionValue($connection, 'username', 'MariaDB'),
                    '--database='.$this->requiredConnectionValue($connection, 'database', 'MariaDB'),
                    '--default-character-set='.$this->requiredConnectionValue($connection, 'charset', 'MariaDB'),
                    '--binary-mode',
                ],
                operation: 'restore',
                input: $backupStream,
            );
        } finally {
            fclose($backupStream);
        }
    }

    private function connectionName(): string
    {
        $connectionName = config('database.default');

        if (! is_string($connectionName) || $connectionName === '') {
            throw new RuntimeException('The default database connection is not configured.');
        }

        return $connectionName;
    }

    /**
     * @return array<string, mixed>
     */
    private function connectionConfiguration(string $connectionName): array
    {
        $connection = config("database.connections.{$connectionName}");

        if (! is_array($connection)) {
            throw new RuntimeException("The database connection [{$connectionName}] is not configured.");
        }

        return (new ConfigurationUrlParser)->parseConfiguration($connection);
    }

    private function backupDirectory(): string
    {
        $backupDirectory = config('database.backup_path', storage_path('app/private/database-backups'));

        if (! is_string($backupDirectory) || $backupDirectory === '') {
            throw new RuntimeException('The database backup path is not configured.');
        }

        return rtrim($backupDirectory, DIRECTORY_SEPARATOR);
    }

    private function backupFileName(string $connectionName, string $extension): string
    {
        return $this->safeConnectionName($connectionName).'-'.now()->format('Y-m-d_His').".{$extension}";
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function sqliteDatabasePath(array $connection): string
    {
        $databasePath = $connection['database'] ?? null;

        if (! is_string($databasePath) || $databasePath === ':memory:' || str_starts_with($databasePath, 'file:')) {
            throw new RuntimeException('SQLite backups require a file-based database.');
        }

        return $databasePath;
    }

    private function resolveBackupPath(string $connectionName, string $backupFileName, string $extension): string
    {
        $safeConnectionName = $this->safeConnectionName($connectionName);

        if (
            basename($backupFileName) !== $backupFileName
            || ! str_starts_with($backupFileName, "{$safeConnectionName}-")
            || pathinfo($backupFileName, PATHINFO_EXTENSION) !== $extension
        ) {
            throw new RuntimeException('The selected database backup is not valid for this connection.');
        }

        $backupPath = $this->backupDirectory().'/'.$backupFileName;

        if (! $this->files->isFile($backupPath)) {
            throw new RuntimeException("The database backup [{$backupFileName}] does not exist.");
        }

        return $backupPath;
    }

    private function safeConnectionName(string $connectionName): string
    {
        $safeConnectionName = preg_replace('/[^A-Za-z0-9_.-]/', '-', $connectionName);

        if (! is_string($safeConnectionName) || $safeConnectionName === '') {
            throw new RuntimeException('The database connection name cannot be used in a backup filename.');
        }

        return $safeConnectionName;
    }

    private function extensionForDriver(mixed $driver): string
    {
        return match ($driver) {
            'sqlite' => 'sqlite',
            'mariadb' => 'sql',
            'pgsql' => 'dump',
            default => throw new RuntimeException("Database driver [{$driver}] is not supported for backups."),
        };
    }

    private function ensureSqliteBackupIntegrity(string $backupPath): void
    {
        try {
            $database = new PDO("sqlite:{$backupPath}", options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $integrityCheck = $database->query('PRAGMA integrity_check')->fetchColumn();
        } catch (PDOException $exception) {
            throw new RuntimeException(
                'The selected SQLite backup failed its integrity check.',
                previous: $exception,
            );
        }

        if ($integrityCheck !== 'ok') {
            throw new RuntimeException('The selected SQLite backup failed its integrity check.');
        }
    }

    /**
     * @param  array<string, mixed>  $connection
     * @return array<string, string>
     */
    private function postgresqlEnvironment(array $connection): array
    {
        $environment = [];
        $password = $connection['password'] ?? null;
        $sslMode = $connection['sslmode'] ?? null;

        if (is_string($password)) {
            $environment['PGPASSWORD'] = $password;
        }

        if (is_string($sslMode) && $sslMode !== '') {
            $environment['PGSSLMODE'] = $sslMode;
        }

        return $environment;
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function requiredConnectionValue(array $connection, string $key, string $database = 'PostgreSQL'): string
    {
        $value = $connection[$key] ?? null;

        if (! is_string($value) && ! is_int($value)) {
            throw new RuntimeException("The {$database} [{$key}] connection setting is not configured.");
        }

        $value = (string) $value;

        if ($value === '') {
            throw new RuntimeException("The {$database} [{$key}] connection setting is not configured.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $connection
     * @param  list<string>  $command
     */
    private function runMariaDbProcess(array $connection, array $command, string $operation, mixed $input = null): void
    {
        $password = $connection['password'] ?? null;
        $environment = is_string($password) ? ['MYSQL_PWD' => $password] : [];

        try {
            $process = Process::forever()->env($environment);

            if ($input !== null) {
                $process->input($input);
            }

            $process->run($command)->throw();
        } catch (ProcessFailedException $exception) {
            $errorOutput = trim($exception->result->errorOutput());
            $reason = $errorOutput !== '' ? $errorOutput : "{$command[0]} exited with an error";

            throw new RuntimeException("MariaDB {$operation} failed: {$reason}", previous: $exception);
        }
    }

    /**
     * @param  array<string, mixed>  $connection
     * @param  list<string>  $command
     */
    private function runPostgresqlProcess(array $connection, array $command, string $operation): void
    {
        try {
            Process::forever()
                ->env($this->postgresqlEnvironment($connection))
                ->run($command)
                ->throw();
        } catch (ProcessFailedException $exception) {
            $errorOutput = trim($exception->result->errorOutput());
            $reason = $errorOutput !== '' ? $errorOutput : "{$command[0]} exited with an error";

            throw new RuntimeException("PostgreSQL {$operation} failed: {$reason}", previous: $exception);
        }
    }
}
