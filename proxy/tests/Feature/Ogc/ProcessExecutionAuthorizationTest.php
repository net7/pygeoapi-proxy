<?php

use App\Enums\Ogc\ExecutionMode;
use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\User;

test('a user owns many process executions', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    expect($user->processExecutions()->first()->is($execution))->toBeTrue();
});

test('process execution casts structured fields and enums', function () {
    $execution = ProcessExecution::factory()->create([
        'execution_mode' => ExecutionMode::Async,
        'status' => ExecutionStatus::Accepted,
        'request_payload' => ['inputs' => ['lat' => 14.47]],
        'requested_outputs' => ['invasion_map' => ['transmissionMode' => 'reference']],
    ]);

    expect($execution->execution_mode)->toBe(ExecutionMode::Async)
        ->and($execution->status)->toBe(ExecutionStatus::Accepted)
        ->and($execution->request_payload['inputs']['lat'])->toBe(14.47)
        ->and($execution->requested_outputs)->toHaveKey('invasion_map');
});

test('process execution has many results', function () {
    $execution = ProcessExecution::factory()->create();
    $result = ProcessExecutionResult::factory()->for($execution)->create();

    expect($execution->results()->first()->is($result))->toBeTrue();
});

test('users cannot view another users execution', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create();

    expect($otherUser->can('view', $execution))->toBeFalse()
        ->and($owner->can('view', $execution))->toBeTrue();
});
