<?php

use App\Enums\UserRole;
use App\Models\User;

test('users are active regular users by default', function () {
    $user = User::factory()->create();

    expect($user->role)->toBe(UserRole::User)
        ->and($user->deactivated_at)->toBeNull()
        ->and($user->isAdmin())->toBeFalse()
        ->and($user->isActive())->toBeTrue()
        ->and($user->isDeactivated())->toBeFalse();
});

test('user factory can create admins', function () {
    $user = User::factory()->admin()->create();

    expect($user->role)->toBe(UserRole::Admin)
        ->and($user->isAdmin())->toBeTrue();
});

test('user factory can create deactivated users', function () {
    $user = User::factory()->deactivated()->create();

    expect($user->deactivated_at)->not->toBeNull()
        ->and($user->isActive())->toBeFalse()
        ->and($user->isDeactivated())->toBeTrue();
});
