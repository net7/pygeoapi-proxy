<?php

use App\Enums\Ogc\ExecutionStatus;
use App\Enums\UserRole;
use App\Models\ProcessExecution;
use App\Models\SocialAccount;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('job tables paginate the full visible dataset using their own saved preferences', function (string $route, string $settingsRoute, bool $admin) {
    $viewer = $admin ? User::factory()->admin()->create() : User::factory()->create();
    $owner = $admin ? User::factory()->create() : $viewer;
    $first = ProcessExecution::factory()->for($owner)->create(['name' => 'Alpha', 'progress' => 99]);
    ProcessExecution::factory()->count(22)->for($owner)->create(['name' => 'Zulu', 'progress' => 1]);
    if (! $admin) {
        ProcessExecution::factory()->create(['name' => 'Another users job']);
    }

    $this->actingAs($viewer)->get(route($route, ['page' => 2]))
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('executions.data', 10)
        ->where('executions.total', 23)
        ->where('executions.per_page', 10)
        ->where('executions.current_page', 2)
        ->where('executions.last_page', 3)
        ->where('statusCounts.accepted', 23)
        );

    $this->patchJson($settingsRoute, [
        'pageSize' => 20,
        'sorting' => [['id' => 'progress', 'desc' => true]],
    ])->assertOk();

    $this->actingAs($viewer->fresh())->get(route($route))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('executions.data', 20)
        ->where('executions.data.0.id', $first->id)
        ->where('executions.total', 23)
        ->where('executions.per_page', 20)
        ->where('tableSettings.pageSize', 20)
        ->where('tableDefaults.pageSize', 10)
        ->where('tableDefaults.sorting.0.id', $admin ? 'submittedAt' : 'createdAt')
    );
})->with([
    'personal jobs' => ['jobs.index', '/settings/tables/jobs', false],
    'admin jobs' => ['admin.jobs.index', '/settings/admin/tables/jobs', true],
]);

test('job filters and counts include matches outside the first page', function (string $route, bool $admin) {
    $viewer = $admin ? User::factory()->admin()->create() : User::factory()->create();
    $owner = $admin ? User::factory()->create() : $viewer;
    $match = ProcessExecution::factory()->for($owner)->create([
        'name' => 'Needle', 'status' => ExecutionStatus::Failed,
    ]);
    ProcessExecution::factory()->for($owner)->create(['name' => 'Needle', 'status' => ExecutionStatus::Running]);
    ProcessExecution::factory()->count(20)->for($owner)->create(['name' => 'Other', 'status' => ExecutionStatus::Accepted]);

    $this->actingAs($viewer)->get(route($route, ['search' => 'Needle', 'status' => 'failed']))
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('executions.data', 1)
        ->where('executions.data.0.id', $match->id)
        ->where('executions.total', 1)
        ->where('statusCounts.failed', 1)
        ->where('statusCounts.running', 1)
        ->where('filters.status', 'failed')
        );
})->with(['personal' => ['jobs.index', false], 'admin' => ['admin.jobs.index', true]]);

test('admin user pagination honors saved sizes and sorts job counts across all users', function () {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create(['name' => 'Alpha Owner']);
    ProcessExecution::factory()->count(3)->for($owner)->create();
    User::factory()->count(23)->create();

    $this->actingAs($admin)->get(route('admin.users.index', ['page' => 2]))
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('users.data', 10)->where('users.total', 25)
        ->where('users.current_page', 2)->where('users.per_page', 10)
        ->where('statusCounts.active', 25)
        ->where('roleCounts.user', 24)
        );
    $this->patchJson('/settings/admin/tables/users', [
        'pageSize' => 50, 'sorting' => [['id' => 'jobs_count', 'desc' => true]],
    ])->assertOk();
    $this->actingAs($admin->fresh())->get(route('admin.users.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('users.data', 25)->where('users.per_page', 50)
        ->where('users.data.0.id', $owner->id)->where('users.data.0.jobs_count', 3)
        ->where('tableDefaults.pageSize', 10)
        ->where('tableDefaults.sorting.0.id', 'created_at')
    );
});

test('admin user role status and provider search filters operate before pagination', function () {
    $admin = User::factory()->admin()->create();
    $match = User::factory()->deactivated()->create();
    SocialAccount::factory()->for($match)->create(['provider' => 'orcid']);
    User::factory()->count(20)->create();

    $this->actingAs($admin)->get(route('admin.users.index', ['search' => 'ORCID', 'role' => 'user', 'status' => 'inactive']))
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('users.data', 1)->where('users.total', 1)
        ->where('users.data.0.id', $match->id)
        ->where('filters.role', 'user')->where('filters.status', 'inactive')
        ->where('statusCounts.inactive', 1)->where('roleCounts.user', 1)
        );
});

test('an emptied last page falls back to the last available page', function () {
    $viewer = User::factory()->create();
    ProcessExecution::factory()->count(11)->for($viewer)->create();

    $this->actingAs($viewer)->get(route('jobs.index', ['page' => 9]))
        ->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('executions.data', 1)->where('executions.current_page', 2)
        ->where('executions.last_page', 2)
        );
});

test('list endpoints reject malformed filters', function (string $route, array $query) {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin)->getJson(route($route, $query))->assertUnprocessable();
})->with([
    'job status' => ['jobs.index', ['status' => 'unknown']],
    'admin page' => ['admin.jobs.index', ['page' => -1]],
    'user role' => ['admin.users.index', ['role' => 'superadmin']],
    'array search' => ['admin.users.index', ['search' => ['unexpected']]],
]);

test('personal job sorting uses the saved column and direction', function (string $column, array $earlier, array $later, bool $descending) {
    $viewer = User::factory()->create(['settings' => ['tables' => ['jobs' => [
        'sorting' => [['id' => $column, 'desc' => $descending]],
    ]]]]);
    $first = ProcessExecution::factory()->for($viewer)->create($earlier);
    $second = ProcessExecution::factory()->for($viewer)->create($later);
    $expected = $descending ? [$second->id, $first->id] : [$first->id, $second->id];

    $this->actingAs($viewer)->get(route('jobs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('executions.data', fn ($rows): bool => $rows->pluck('id')->all() === $expected)
        );
})->with([
    'display name' => ['process', ['name' => ' Alpha '], ['name' => 'zulu']],
    'status priority' => ['status', ['status' => ExecutionStatus::Running], ['status' => ExecutionStatus::Failed]],
    'local identifier' => ['jobId', [], []],
    'message' => ['message', ['message' => 'Alpha'], ['message' => 'zulu']],
    'created date' => ['createdAt', ['created_at' => '2026-09-01 12:00:00'], ['created_at' => '2026-09-02 12:00:00']],
    'submitted date' => ['submittedAt', ['submitted_at' => '2026-09-01 12:00:00'], ['submitted_at' => '2026-09-02 12:00:00']],
    'finished date' => ['finishedAt', ['completed_at' => '2026-09-01 12:00:00'], ['failed_at' => '2026-09-02 12:00:00']],
    'progress' => ['progress', ['progress' => 9], ['progress' => 50]],
])->with(['ascending' => false, 'descending' => true]);

test('admin jobs sort by owner name and email', function () {
    $admin = User::factory()->admin()->create(['settings' => ['tables' => ['admin' => ['jobs' => [
        'sorting' => [['id' => 'user', 'desc' => false]],
    ]]]]]);
    $alpha = User::factory()->create(['name' => 'Owner', 'email' => 'alpha@example.test']);
    $zulu = User::factory()->create(['name' => 'Owner', 'email' => 'zulu@example.test']);
    $first = ProcessExecution::factory()->for($alpha)->create();
    $second = ProcessExecution::factory()->for($zulu)->create();

    $this->actingAs($admin)->get(route('admin.jobs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('executions.data.0.id', $first->id)
            ->where('executions.data.1.id', $second->id)
        );
});

test('job status sorting follows the full execution lifecycle priority', function () {
    $viewer = User::factory()->create(['settings' => ['tables' => ['jobs' => [
        'sorting' => [['id' => 'status', 'desc' => false]],
    ]]]]);
    foreach (['failed', 'remote_missing', 'accepted', 'successful', 'submission_failed', 'submitting', 'running'] as $status) {
        ProcessExecution::factory()->for($viewer)->create(['status' => $status]);
    }

    $this->actingAs($viewer)->get(route('jobs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('executions.data', fn ($rows): bool => $rows->pluck('status')->all() === [
                'submitting', 'accepted', 'running', 'successful', 'failed', 'submission_failed', 'remote_missing',
            ])
        );
});

test('process sorting uses fallback display names even when a creation date is absent', function () {
    $viewer = User::factory()->create(['settings' => ['tables' => ['jobs' => [
        'sorting' => [['id' => 'process', 'desc' => false]],
    ]]]]);
    $alpha = ProcessExecution::factory()->for($viewer)->create([
        'name' => ' ', 'process_title' => 'Alpha', 'created_at' => '2026-09-01 12:00:00',
    ]);
    $beta = ProcessExecution::factory()->for($viewer)->create([
        'name' => null, 'process_title' => null, 'process_id' => 'Beta', 'created_at' => '2026-09-01 12:00:00',
    ]);
    $zulu = ProcessExecution::factory()->for($viewer)->create([
        'name' => null, 'process_title' => 'Zulu', 'created_at' => null,
    ]);

    $this->actingAs($viewer)->get(route('jobs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('executions.data.0.id', $alpha->id)
            ->where('executions.data.0.displayName', 'Alpha 01/09/2026 12:00')
            ->where('executions.data.1.id', $beta->id)
            ->where('executions.data.2.id', $zulu->id)
            ->where('executions.data.2.displayName', 'Zulu')
        );
});

test('job sorting applies secondary columns and a stable identifier tie breaker', function () {
    $viewer = User::factory()->create(['settings' => ['tables' => ['jobs' => [
        'sorting' => [['id' => 'status', 'desc' => false], ['id' => 'progress', 'desc' => true]],
    ]]]]);
    $running = ProcessExecution::factory()->for($viewer)->create(['status' => ExecutionStatus::Running, 'progress' => 100]);
    $slow = ProcessExecution::factory()->for($viewer)->create(['status' => ExecutionStatus::Accepted, 'progress' => 1]);
    $fast = ProcessExecution::factory()->for($viewer)->create(['status' => ExecutionStatus::Accepted, 'progress' => 50]);
    $newFast = ProcessExecution::factory()->for($viewer)->create(['status' => ExecutionStatus::Accepted, 'progress' => 50]);

    $this->actingAs($viewer)->get(route('jobs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('executions.data', fn ($rows): bool => $rows->pluck('id')->all() === [
                $newFast->id, $fast->id, $slow->id, $running->id,
            ])
        );
});

test('admin user sorting uses the saved column and direction', function (string $column, array $earlier, array $later, bool $descending) {
    $admin = User::factory()->admin()->create(['settings' => ['tables' => ['admin' => ['users' => [
        'sorting' => [['id' => $column, 'desc' => $descending]],
    ]]]]]);
    $first = User::factory()->create([...$earlier, 'name' => 'Sort fixture']);
    $second = User::factory()->create([...$later, 'name' => 'Sort fixture']);
    $expected = $descending ? [$second->id, $first->id] : [$first->id, $second->id];

    $this->actingAs($admin)->get(route('admin.users.index', ['search' => 'Sort fixture']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('users.data', fn ($rows): bool => $rows->pluck('id')->all() === $expected)
        );
})->with([
    'identity including email' => ['user', ['email' => 'alpha@example.test'], ['email' => 'zulu@example.test']],
    'role' => ['role', ['role' => UserRole::Admin], ['role' => UserRole::User]],
    'account status' => ['status', ['deactivated_at' => null], ['deactivated_at' => '2026-09-01 12:00:00']],
    'first access date' => ['first_access_completed_at', ['first_access_completed_at' => null], ['first_access_completed_at' => '2026-09-02 12:00:00']],
    'created date' => ['created_at', ['created_at' => '2026-09-01 12:00:00'], ['created_at' => '2026-09-02 12:00:00']],
])->with(['ascending' => false, 'descending' => true]);

test('provider sorting uses unique sorted labels with local account fallback', function () {
    $admin = User::factory()->admin()->create(['settings' => ['tables' => ['admin' => ['users' => [
        'sorting' => [['id' => 'socialProviders', 'desc' => false]],
    ]]]]]);
    $duplicate = User::factory()->create(['name' => 'Sort fixture duplicates']);
    SocialAccount::factory()->for($duplicate)->create(['provider' => 'orcid']);
    SocialAccount::factory()->count(2)->for($duplicate)->create(['provider' => 'google']);
    $multiple = User::factory()->create(['name' => 'Sort fixture multiple']);
    SocialAccount::factory()->for($multiple)->create(['provider' => 'orcid']);
    SocialAccount::factory()->for($multiple)->create(['provider' => 'google']);
    $google = User::factory()->create(['name' => 'Sort fixture google']);
    SocialAccount::factory()->for($google)->create(['provider' => 'google']);
    $local = User::factory()->create(['name' => 'Sort fixture local']);
    $orcid = User::factory()->create(['name' => 'Sort fixture orcid']);
    SocialAccount::factory()->for($orcid)->create(['provider' => 'orcid']);

    $this->actingAs($admin)->get(route('admin.users.index', ['search' => 'Sort fixture']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('users.data', fn ($rows): bool => $rows->pluck('id')->all() === [
                $google->id, $multiple->id, $duplicate->id, $local->id, $orcid->id,
            ])
        );
});

test('an empty sorting preference still provides stable page boundaries', function () {
    $viewer = User::factory()->create(['settings' => ['tables' => ['jobs' => ['sorting' => []]]]]);
    $jobs = ProcessExecution::factory()->count(11)->for($viewer)->create();

    $this->actingAs($viewer)->get(route('jobs.index', ['page' => 2]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('executions.data', 1)
            ->where('executions.data.0.id', $jobs->first()->id)
        );
});

test('job search escapes wildcard characters and hides remote identifiers from regular users', function () {
    $viewer = User::factory()->create();
    $match = ProcessExecution::factory()->for($viewer)->create(['name' => 'Complete 50%_!']);
    ProcessExecution::factory()->for($viewer)->create(['name' => 'Complete 50ABC']);
    ProcessExecution::factory()->for($viewer)->create(['name' => 'Remote only', 'remote_job_id' => 'Complete 50%_!']);

    $this->actingAs($viewer)->get(route('jobs.index', ['search' => '50%_!']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('executions.data', 1)
            ->where('executions.data.0.id', $match->id)
        );
});
