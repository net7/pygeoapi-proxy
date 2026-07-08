<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

test('users make admin promotes an existing user selected with a search prompt', function () {
    Notification::fake();

    $user = User::factory()->create([
        'name' => 'Target User',
        'email' => 'target@example.com',
    ]);

    User::factory()->admin()->create([
        'name' => 'Target Admin',
        'email' => 'target.admin@example.com',
    ]);

    $this->artisan('users:make-admin')
        ->expectsSearch(
            'Select the existing user to promote',
            answer: $user->email,
            search: 'target',
            answers: [
                $user->email => 'Target User <target@example.com>',
            ],
        )
        ->expectsPromptsInfo('User promoted to administrator.')
        ->assertSuccessful();

    expect($user->fresh()->role)->toBe(UserRole::Admin);

    Notification::assertNothingSent();
});

test('users make admin promotes an existing user by email without creating users', function () {
    Notification::fake();

    $user = User::factory()->deactivated()->create([
        'email' => 'existing@example.com',
    ]);

    $this->artisan('users:make-admin', [
        'email' => 'Existing@Example.com',
    ])
        ->expectsPromptsInfo('User promoted to administrator.')
        ->assertSuccessful();

    expect($user->fresh()->role)->toBe(UserRole::Admin)
        ->and($user->fresh()->deactivated_at)->toBeNull()
        ->and(User::query()->count())->toBe(1);

    Notification::assertNothingSent();
});

test('users make admin does not create an admin when the email is missing', function () {
    Notification::fake();

    $this->artisan('users:make-admin', [
        'email' => 'missing@example.com',
    ])
        ->expectsPromptsError('No non-admin user found for missing@example.com.')
        ->assertFailed();

    expect(User::query()->where('email', 'missing@example.com')->exists())->toBeFalse();

    Notification::assertNothingSent();
});

test('users make admin fails when there are no non-admin users to promote', function () {
    User::factory()->admin()->create();

    $this->artisan('users:make-admin')
        ->expectsPromptsError('There are no non-admin users to promote.')
        ->assertFailed();
});
