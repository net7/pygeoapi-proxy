<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;

test('users make admin promotes an existing user', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->artisan('users:make-admin', ['email' => $user->email])
        ->assertSuccessful();

    expect($user->fresh()->role)->toBe(UserRole::Admin);

    Notification::assertNothingSent();
});

test('users make admin creates an admin and sends a password setup link', function () {
    Notification::fake();

    $this->artisan('users:make-admin', [
        'email' => 'New.Admin@Example.com',
        '--name' => 'New Admin',
    ])->assertSuccessful();

    $user = User::query()->where('email', 'new.admin@example.com')->firstOrFail();

    expect($user->name)->toBe('New Admin')
        ->and($user->role)->toBe(UserRole::Admin)
        ->and($user->password)->toBeNull()
        ->and($user->email_verified_at)->not->toBeNull();

    Notification::assertSentTo($user, ResetPassword::class);
});
