<?php

use App\Models\ProcessExecution;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('admin job management is restricted to administrators', function () {
    $this->get(route('admin.jobs.index'))
        ->assertRedirect(route('login'));

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.jobs.index'))
        ->assertForbidden();
});

test('admins can see all jobs with owners', function () {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create([
        'name' => 'Process Owner',
        'email' => 'owner@example.com',
    ]);
    $execution = ProcessExecution::factory()->for($owner)->create([
        'process_id' => 'conduit',
        'process_title' => 'CONDUIT',
    ]);

    $this->actingAs($admin)
        ->get(route('admin.jobs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/jobs/index')
            ->has('executions.data', 1)
            ->where('executions.data.0.id', $execution->id)
            ->where('executions.data.0.processId', 'conduit')
            ->where('executions.data.0.owner.name', 'Process Owner')
            ->where('executions.data.0.owner.email', 'owner@example.com')
        );
});

test('admins can filter all jobs by user', function () {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create([
        'name' => 'Process Owner',
        'email' => 'owner@example.com',
    ]);
    $otherOwner = User::factory()->create([
        'name' => 'Other Owner',
        'email' => 'other@example.com',
    ]);
    $execution = ProcessExecution::factory()->for($owner)->create([
        'process_id' => 'conduit',
        'process_title' => 'CONDUIT',
    ]);
    ProcessExecution::factory()->for($otherOwner)->create([
        'process_id' => 'pybox',
        'process_title' => 'PYBOX',
    ]);

    $this->actingAs($admin)
        ->get(route('admin.jobs.index', ['user_id' => $owner->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/jobs/index')
            ->has('users', 3)
            ->where('filters.user_id', $owner->id)
            ->has('executions.data', 1)
            ->where('executions.data.0.id', $execution->id)
            ->where('executions.data.0.owner.email', 'owner@example.com')
        );

    $this->actingAs($admin)
        ->get(route('admin.jobs.index', [
            'user_id' => $owner->id,
            'search' => 'PYBOX',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/jobs/index')
            ->where('filters.search', 'PYBOX')
            ->where('filters.user_id', $owner->id)
            ->has('executions.data', 0)
        );
});

test('admins can view another users job detail', function () {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create();

    expect($admin->can('view', $execution))->toBeTrue();

    $this->actingAs($admin)
        ->get(route('jobs.show', $execution))
        ->assertOk();
});
