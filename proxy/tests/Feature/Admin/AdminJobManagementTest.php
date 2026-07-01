<?php

use App\Models\ProcessExecution;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
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
    Storage::fake('public');
    Storage::disk('public')->put('avatars/process-owner.jpg', 'avatar');

    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create([
        'name' => 'Process Owner',
        'email' => 'owner@example.com',
        'avatar_path' => 'avatars/process-owner.jpg',
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
            ->where('executions.data.0.owner.avatar', route('profile.avatar.show', ['path' => 'avatars/process-owner.jpg'], absolute: false))
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
    $ownerFilter = Crypt::encryptString((string) $owner->id);

    $this->actingAs($admin)
        ->get(route('admin.jobs.index', ['user' => $ownerFilter]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/jobs/index')
            ->has('users', 3)
            ->where('filters.selectedUserId', $owner->id)
            ->has('executions.data', 1)
            ->where('executions.data.0.id', $execution->id)
            ->where('executions.data.0.owner.email', 'owner@example.com')
        );

    $this->actingAs($admin)
        ->get(route('admin.jobs.index', [
            'user' => $ownerFilter,
            'search' => 'PYBOX',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/jobs/index')
            ->where('filters.search', 'PYBOX')
            ->where('filters.selectedUserId', $owner->id)
            ->has('executions.data', 0)
        );
});

test('admins cannot filter all jobs with a tampered user token', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get(route('admin.jobs.index', ['user' => '1']))
        ->assertNotFound();
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
