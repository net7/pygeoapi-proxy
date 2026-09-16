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

    protected function ensureTestingDatabaseIsIsolated(): void
    {
        $defaultConnection = config('database.default');
        $database = config("database.connections.{$defaultConnection}.database");

        if ($defaultConnection !== 'sqlite_testing') {
            $this->fail("Tests must use the sqlite_testing connection; [{$defaultConnection}] could contain application data.");
        }

        if ($database === database_path('database.sqlite')) {
            $this->fail('Tests are configured to use database/database.sqlite. Use the sqlite_testing connection instead.');
        }

        if (
            config('database.connections.sqlite_testing.driver') !== 'sqlite'
            || filled(config('database.connections.sqlite_testing.url'))
            || $database !== ':memory:'
        ) {
            $this->fail('Tests must use SQLite in memory without a connection URL.');
        }
    }
}
