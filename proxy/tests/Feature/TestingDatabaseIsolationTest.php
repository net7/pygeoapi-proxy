<?php

test('the test suite uses the dedicated testing database connection', function () {
    $databasePath = config('database.connections.sqlite_testing.database');

    expect(config('database.default'))->toBe('sqlite_testing')
        ->and($databasePath)->toBe(database_path('testing.sqlite'))
        ->and($databasePath)->not->toBe(database_path('database.sqlite'));
});
