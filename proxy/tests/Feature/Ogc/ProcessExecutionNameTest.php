<?php

use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\OgcProcessCache;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Bus;
use Inertia\Testing\AssertableInertia as Assert;

afterEach(function () {
    Carbon::setTestNow();
});

test('starting a process stores an optional process name and exposes it in job tables', function () {
    Bus::fake();

    $user = User::factory()->create();
    app(OgcProcessCache::class)->putProcess('solwcad', ogcFixture('process-solwcad'));

    $this->actingAs($user)->post(route('processes.jobs.store', 'solwcad'), [
        'name' => 'Scenario crater north',
        'inputs' => ogcFixture('process-solwcad')['examples'][0]['payload_example']['inputs'],
    ])->assertRedirect();

    $execution = ProcessExecution::query()->sole();

    expect($execution->name)->toBe('Scenario crater north');

    $this->actingAs($user)
        ->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('process-executions/index')
            ->where('executions.data.0.name', 'Scenario crater north')
            ->where('executions.data.0.displayName', 'Scenario crater north')
        );
});

test('job display name falls back to process title and creation date when name is empty', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-02 15:01:00'));

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'name' => null,
        'process_title' => 'SOLWCAD',
        'created_at' => CarbonImmutable::parse('2026-07-02 15:01:00'),
    ]);

    $this->actingAs($user)
        ->get(route('jobs.show', $execution))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('process-executions/show')
            ->where('execution.name', null)
            ->where('execution.displayName', 'SOLWCAD 02/07/2026 15:01')
        );
});

test('job owners can update and clear process names after creation', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'name' => null,
        'process_title' => 'SOLWCAD',
        'created_at' => CarbonImmutable::parse('2026-07-02 15:01:00'),
        'status' => ExecutionStatus::Running,
    ]);

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->patch(route('jobs.name.update', $execution), ['name' => 'Scenario crater south'])
        ->assertRedirect(route('jobs.show', $execution))
        ->assertInertiaFlash('toast.title', 'Process name saved');

    expect($execution->refresh()->name)->toBe('Scenario crater south')
        ->and($execution->displayName())->toBe('Scenario crater south');

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->patch(route('jobs.name.update', $execution), ['name' => '   '])
        ->assertRedirect(route('jobs.show', $execution));

    expect($execution->refresh()->name)->toBeNull()
        ->and($execution->displayName())->toBe('SOLWCAD 02/07/2026 15:01');
});

test('users cannot update another users process name', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'name' => 'Owner scenario',
    ]);

    $this->actingAs($otherUser)
        ->patch(route('jobs.name.update', $execution), ['name' => 'Tampered name'])
        ->assertForbidden();

    expect($execution->refresh()->name)->toBe('Owner scenario');
});
