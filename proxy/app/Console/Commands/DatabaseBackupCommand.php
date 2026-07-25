<?php

namespace App\Console\Commands;

use App\Services\DatabaseBackupManager;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RuntimeException;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\error;
use function Laravel\Prompts\info;
use function Laravel\Prompts\select;
use function Laravel\Prompts\spin;

#[Signature('db:backup
    {action? : Operation to perform (backup or restore)}
    {file? : Backup filename to restore}
    {--force : Restore without asking for confirmation}')]
#[Description('Create or restore a backup of the configured database')]
class DatabaseBackupCommand extends Command
{
    /**
     * @var array<string, string>
     */
    private const ACTIONS = [
        'backup' => 'Create a backup',
        'restore' => 'Restore a backup',
    ];

    /**
     * Execute the console command.
     */
    public function handle(DatabaseBackupManager $databaseBackupManager): int
    {
        $action = $this->action();

        if (! array_key_exists($action, self::ACTIONS)) {
            error("Unsupported action [{$action}]. Use [backup] or [restore].");

            return self::FAILURE;
        }

        try {
            return match ($action) {
                'backup' => $this->createBackup($databaseBackupManager),
                'restore' => $this->restoreBackup($databaseBackupManager),
            };
        } catch (RuntimeException $exception) {
            error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function action(): string
    {
        $actionArgument = $this->argument('action');

        if ($actionArgument !== null) {
            return (string) $actionArgument;
        }

        return (string) select(
            label: 'What would you like to do?',
            options: self::ACTIONS,
            default: 'backup',
        );
    }

    private function createBackup(DatabaseBackupManager $databaseBackupManager): int
    {
        $backupPath = spin(
            callback: fn (): string => $databaseBackupManager->backup(),
            message: 'Creating database backup...',
        );

        info("Database backup created: {$backupPath}");

        return self::SUCCESS;
    }

    private function restoreBackup(DatabaseBackupManager $databaseBackupManager): int
    {
        $backupFileName = $this->backupFileName($databaseBackupManager);

        if ($backupFileName === null) {
            return self::FAILURE;
        }

        if (! (bool) $this->option('force') && ! confirm(
            label: "Restore [{$backupFileName}]? The current database will be replaced.",
            default: false,
            yes: 'Restore',
            no: 'Cancel',
        )) {
            info('Database restore cancelled.');

            return self::SUCCESS;
        }

        $backupPath = spin(
            callback: fn (): string => $databaseBackupManager->restore($backupFileName),
            message: 'Restoring database backup...',
        );

        info("Database restored from: {$backupPath}");

        return self::SUCCESS;
    }

    private function backupFileName(DatabaseBackupManager $databaseBackupManager): ?string
    {
        $fileArgument = $this->argument('file');

        if ($fileArgument !== null) {
            return (string) $fileArgument;
        }

        $backups = $databaseBackupManager->availableBackups();

        if ($backups === []) {
            error('There are no database backups available to restore.');

            return null;
        }

        return (string) select(
            label: 'Which backup would you like to restore?',
            options: $backups,
        );
    }
}
