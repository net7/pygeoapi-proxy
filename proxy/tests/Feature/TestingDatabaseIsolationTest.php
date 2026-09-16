<?php

use PHPUnit\Framework\AssertionFailedError;

test('the test suite uses the dedicated testing database connection', function () {
    $databasePath = config('database.connections.sqlite_testing.database');

    expect(config('database.default'))->toBe('sqlite_testing')
        ->and($databasePath)->toBe(':memory:')
        ->and($databasePath)->not->toBe(database_path('database.sqlite'));
});

test('the test suite isolates services from container environment variables', function () {
    expect(app()->environment())->toBe('testing')
        ->and(config('queue.default'))->toBe('sync')
        ->and(config('cache.default'))->toBe('array')
        ->and(config('session.driver'))->toBe('array')
        ->and(config('mail.default'))->toBe('array')
        ->and(config('broadcasting.default'))->toBeNull();
});

test('it rejects application database connections before refreshing the database', function (string $connection) {
    config(['database.default' => $connection]);

    try {
        expect(fn () => $this->setUpTraits())->toThrow(AssertionFailedError::class, 'Tests must use the sqlite_testing connection');
    } finally {
        config(['database.default' => 'sqlite_testing']);
    }
})->with(['mariadb', 'mysql', 'sqlite']);

test('it rejects an application database configured on the testing connection', function () {
    $testingDatabase = config('database.connections.sqlite_testing.database');
    config(['database.connections.sqlite_testing.database' => database_path('database.sqlite')]);

    try {
        expect(fn () => $this->setUpTraits())->toThrow(AssertionFailedError::class, 'Tests are configured to use database/database.sqlite');
    } finally {
        config(['database.connections.sqlite_testing.database' => $testingDatabase]);
    }
});

test('it rejects unsafe testing connection settings', function (array $settings) {
    $testingConnection = config('database.connections.sqlite_testing');
    config(['database.connections.sqlite_testing' => array_replace($testingConnection, $settings)]);

    try {
        expect(fn () => $this->ensureTestingDatabaseIsIsolated())->toThrow(AssertionFailedError::class, 'Tests must use SQLite in memory without a connection URL');
    } finally {
        config(['database.connections.sqlite_testing' => $testingConnection]);
    }
})->with([
    'non SQLite driver' => [['driver' => 'mysql']],
    'URL overrides the database' => [['url' => 'sqlite:///:memory:']],
]);

test('it rejects another SQLite file', function () {
    $testingDatabase = config('database.connections.sqlite_testing.database');
    $otherDatabase = tempnam(sys_get_temp_dir(), 'pygeoapi-isolation-');
    config(['database.connections.sqlite_testing.database' => $otherDatabase]);

    try {
        expect(fn () => $this->ensureTestingDatabaseIsIsolated())->toThrow(AssertionFailedError::class, 'Tests must use SQLite in memory without a connection URL');
    } finally {
        config(['database.connections.sqlite_testing.database' => $testingDatabase]);
        unlink($otherDatabase);
    }
});
