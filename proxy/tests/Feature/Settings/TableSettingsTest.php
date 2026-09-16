<?php

use App\Enums\TableKey;
use App\Models\User;
use App\Support\UserTableSettings;
use Inertia\Testing\AssertableInertia as Assert;

test('table settings require authentication', function (string $method, string $path) {
    $this->json($method, $path, ['pageSize' => 20])->assertUnauthorized();
})->with([
    ['PATCH', '/settings/tables/jobs'],
    ['DELETE', '/settings/tables/jobs'],
    ['PATCH', '/settings/admin/tables/jobs'],
    ['DELETE', '/settings/admin/tables/jobs'],
    ['PATCH', '/settings/admin/tables/users'],
    ['DELETE', '/settings/admin/tables/users'],
]);

test('users can save their personal table preferences', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $this->actingAs($user)
        ->patchJson('/settings/tables/jobs', [
            'columnVisibility' => ['message' => true],
            'sorting' => [['id' => 'status', 'desc' => false]],
            'pageSize' => 20,
        ])
        ->assertOk()
        ->assertExactJson(['settings' => [
            'columnVisibility' => ['finishedAt' => false, 'message' => true, 'submittedAt' => false],
            'sorting' => [['id' => 'status', 'desc' => false]],
            'pageSize' => 20,
        ]]);

    expect($user->refresh()->settings)->toEqual(['tables' => ['jobs' => [
        'columnVisibility' => ['message' => true],
        'sorting' => [['id' => 'status', 'desc' => false]],
        'pageSize' => 20,
    ]]]);
    expect($otherUser->refresh()->settings)->toBeNull();
});

test('admin table settings return 403 for regular users', function (string $method, string $path) {
    $user = User::factory()->create();

    $this->actingAs($user)->json($method, $path, ['pageSize' => 20])->assertForbidden();

    expect($user->refresh()->settings)->toBeNull();
})->with([
    ['PATCH', '/settings/admin/tables/jobs'],
    ['DELETE', '/settings/admin/tables/jobs'],
    ['PATCH', '/settings/admin/tables/users'],
    ['DELETE', '/settings/admin/tables/users'],
]);

test('deactivated users cannot save table preferences', function () {
    $user = User::factory()->deactivated()->create();

    $this->actingAs($user)->patchJson('/settings/tables/jobs', ['pageSize' => 20])
        ->assertRedirect(route('account.deactivated'));

    expect($user->refresh()->settings)->toBeNull();
});

test('admins save their own admin preferences in the route selected section', function (string $table, string $sort) {
    $admin = User::factory()->admin()->create();
    $otherAdmin = User::factory()->admin()->create();

    $this->actingAs($admin)->patchJson("/settings/admin/tables/{$table}", ['pageSize' => 50])
        ->assertOk()
        ->assertJsonPath('settings.pageSize', 50)
        ->assertJsonPath('settings.sorting', [['id' => $sort, 'desc' => true]]);

    expect($admin->refresh()->settings)->toBe(['tables' => ['admin' => [$table => ['pageSize' => 50]]]]);
    expect($otherAdmin->refresh()->settings)->toBeNull();
})->with([
    ['jobs', 'submittedAt'],
    ['users', 'created_at'],
]);

test('partial updates merge visibility and preserve omitted preferences and other settings', function () {
    $user = User::factory()->admin()->create(['settings' => [
        'theme' => 'dark',
        'tables' => [
            'jobs' => [
                'columnVisibility' => ['message' => true, 'process' => false],
                'sorting' => [['id' => 'status', 'desc' => false]],
                'pageSize' => 50,
            ],
            'admin' => ['users' => ['pageSize' => 20]],
        ],
    ]]);

    $this->actingAs($user)->patchJson('/settings/tables/jobs', ['columnVisibility' => ['message' => false]])
        ->assertOk()
        ->assertJsonPath('settings.columnVisibility.process', false)
        ->assertJsonPath('settings.columnVisibility.message', false)
        ->assertJsonPath('settings.sorting', [['id' => 'status', 'desc' => false]])
        ->assertJsonPath('settings.pageSize', 50);

    expect($user->refresh()->settings)->toBe([
        'theme' => 'dark',
        'tables' => [
            'jobs' => [
                'columnVisibility' => ['message' => false, 'process' => false],
                'sorting' => [['id' => 'status', 'desc' => false]],
                'pageSize' => 50,
            ],
            'admin' => ['users' => ['pageSize' => 20]],
        ],
    ]);
});

test('updates merge against the latest stored settings instead of the authenticated snapshot', function () {
    $user = User::factory()->admin()->create(['settings' => ['tables' => ['jobs' => ['pageSize' => 10]]]]);
    $latestUser = $user->fresh();
    $latestUser->forceFill(['settings' => [
        'tables' => [
            'jobs' => ['pageSize' => 50],
            'admin' => ['users' => ['pageSize' => 20]],
        ],
    ]])->save();

    $this->actingAs($user)->patchJson('/settings/tables/jobs', ['columnVisibility' => ['message' => true]])
        ->assertOk()
        ->assertJsonPath('settings.pageSize', 50);

    expect($user->refresh()->settings['tables']['admin']['users'])->toBe(['pageSize' => 20]);
});

test('sorting is replaced completely including an empty list', function (array $sorting) {
    $user = User::factory()->create(['settings' => ['tables' => ['jobs' => [
        'sorting' => [['id' => 'createdAt', 'desc' => true], ['id' => 'status', 'desc' => false]],
    ]]]]);

    $this->actingAs($user)->patchJson('/settings/tables/jobs', ['sorting' => $sorting])
        ->assertOk()
        ->assertJsonPath('settings.sorting', $sorting);

    expect($user->refresh()->settings['tables']['jobs']['sorting'])->toBe($sorting);
})->with([
    'clear sorting' => [[]],
    'replace sorting' => [[['id' => 'message', 'desc' => false]]],
]);

test('invalid preference values return 422 without changing settings', function (array $payload, string $error) {
    $user = User::factory()->create();

    $this->actingAs($user)->patchJson('/settings/tables/jobs', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$error]);

    expect($user->refresh()->settings)->toBeNull();
})->with([
    'unsupported page size' => [['pageSize' => 15], 'pageSize'],
    'noninteger page size' => [['pageSize' => '20'], 'pageSize'],
    'null page size' => [['pageSize' => null], 'pageSize'],
    'unknown column' => [['columnVisibility' => ['obsolete' => false]], 'columnVisibility'],
    'search helper column' => [['columnVisibility' => ['jobSearch' => true]], 'columnVisibility'],
    'selection column' => [['columnVisibility' => ['select' => false]], 'columnVisibility'],
    'action column' => [['columnVisibility' => ['actions' => false]], 'columnVisibility'],
    'nonboolean visibility' => [['columnVisibility' => ['message' => 'false']], 'columnVisibility.message'],
    'nonboolean sorting direction' => [['sorting' => [['id' => 'status', 'desc' => 'false']]], 'sorting.0.desc'],
    'unknown sorting column' => [['sorting' => [['id' => 'select', 'desc' => false]]], 'sorting.0.id'],
    'duplicate sorting column' => [['sorting' => [['id' => 'status', 'desc' => false], ['id' => 'status', 'desc' => true]]], 'sorting.0.id'],
    'incomplete sorting entry' => [['sorting' => [['id' => 'status']]], 'sorting.0.desc'],
    'extra sorting properties' => [['sorting' => [['id' => 'status', 'desc' => true, 'sql' => 'id']]], 'sorting.0'],
    'sorting must be a list' => [['sorting' => ['column' => ['id' => 'status', 'desc' => true]]], 'sorting'],
    'another table cannot be selected in the payload' => [['table' => 'admin.users', 'pageSize' => 20], 'table'],
    'another user cannot be selected in the payload' => [['user_id' => 999, 'pageSize' => 20], 'user_id'],
]);

test('column validation uses the selected admin table', function (string $table, string $column) {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->patchJson("/settings/admin/tables/{$table}", ['columnVisibility' => [$column => false]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['columnVisibility']);

    expect($admin->refresh()->settings)->toBeNull();
})->with([
    ['jobs', 'userId'],
    ['jobs', 'createdAt'],
    ['users', 'userSearch'],
    ['users', 'process'],
]);

test('reset removes only the selected table preferences', function (string $path, string $key, string $sort) {
    $admin = User::factory()->admin()->create(['settings' => [
        'theme' => 'dark',
        'tables' => [
            'jobs' => ['pageSize' => 50],
            'admin' => ['jobs' => ['pageSize' => 20], 'users' => ['pageSize' => 50]],
        ],
    ]]);

    $this->actingAs($admin)->deleteJson($path)
        ->assertOk()
        ->assertJsonPath('settings.pageSize', 10)
        ->assertJsonPath('settings.sorting', [['id' => $sort, 'desc' => true]]);

    $settings = $admin->refresh()->settings;
    expect(data_get($settings, "tables.{$key}"))->toBeNull();
    expect($settings['theme'])->toBe('dark');
    expect(data_get($settings, $key === 'jobs' ? 'tables.admin.users.pageSize' : 'tables.jobs.pageSize'))->toBe(50);
})->with([
    ['/settings/tables/jobs', 'jobs', 'createdAt'],
    ['/settings/admin/tables/jobs', 'admin.jobs', 'submittedAt'],
    ['/settings/admin/tables/users', 'admin.users', 'created_at'],
]);

test('resetting an unconfigured table returns defaults', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->deleteJson('/settings/tables/jobs')
        ->assertOk()
        ->assertExactJson(['settings' => [
            'columnVisibility' => ['finishedAt' => false, 'message' => false, 'submittedAt' => false],
            'sorting' => [['id' => 'createdAt', 'desc' => true]],
            'pageSize' => 10,
        ]]);
});

test('shared preferences project allowed settings without leaking admin preferences', function () {
    $user = User::factory()->create(['settings' => [
        'private' => 'not a shared preference',
        'tables' => [
            'jobs' => ['pageSize' => 20],
            'admin' => ['users' => ['pageSize' => 50]],
            'obsolete' => ['pageSize' => 10],
        ],
    ]]);

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.settings.tables.jobs.pageSize', 20)
            ->where('auth.user.settings.tables.jobs.sorting', [['id' => 'createdAt', 'desc' => true]])
            ->missing('auth.user.settings.tables.admin')
            ->missing('auth.user.settings.tables.obsolete')
            ->missing('auth.user.settings.private')
        );

    expect($user->toArray())->not->toHaveKey('settings');
});

test('admins receive defaults for every supported table in shared settings', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.settings.tables.jobs.pageSize', 10)
            ->where('auth.user.settings.tables.admin.jobs.sorting', [['id' => 'submittedAt', 'desc' => true]])
            ->where('auth.user.settings.tables.admin.users.sorting', [['id' => 'created_at', 'desc' => true]])
        );
});

test('obsolete and malformed stored values fall back to valid defaults', function () {
    $user = User::factory()->create(['settings' => ['tables' => ['jobs' => [
        'columnVisibility' => ['message' => true, 'process' => 'false', 'obsolete' => false, 'jobSearch' => true],
        'sorting' => [['id' => 'obsolete', 'desc' => false], ['id' => 'status', 'desc' => 'false']],
        'pageSize' => 15,
        'filter' => 'not persisted',
    ]]]]);

    expect(app(UserTableSettings::class)->forUser($user, TableKey::Jobs))->toBe([
        'columnVisibility' => ['finishedAt' => false, 'message' => true, 'submittedAt' => false],
        'sorting' => [['id' => 'createdAt', 'desc' => true]],
        'pageSize' => 10,
    ]);
});
