<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * @return array<class-string, int>
     */
    protected function setUpTraits(): array
    {
        $this->ensureTestingDatabaseIsIsolated();

        return parent::setUpTraits();
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }

    private function ensureTestingDatabaseIsIsolated(): void
    {
        $defaultConnection = config('database.default');
        $database = config("database.connections.{$defaultConnection}.database");

        if ($defaultConnection === 'sqlite_testing' && is_string($database)) {
            $this->ensureTestingSqliteDatabaseExists($database);
        }

        if ($database === database_path('database.sqlite')) {
            $this->fail('Tests are configured to use database/database.sqlite. Use the sqlite_testing connection instead.');
        }
    }

    private function ensureTestingSqliteDatabaseExists(string $database): void
    {
        if ($database === ':memory:' || str_starts_with($database, 'file:') || file_exists($database)) {
            return;
        }

        if (! touch($database)) {
            $this->fail("Unable to create the testing SQLite database at [{$database}].");
        }
    }
}
