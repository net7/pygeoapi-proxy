<?php

use App\Enums\UserRole;
use App\Models\ProcessExecution;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

test('admin user management is restricted to administrators', function () {
    $guestResponse = $this->get(route('admin.users.index'));
    $guestResponse->assertRedirect(route('login'));

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.users.index'))
        ->assertForbidden();
});

test('admins can see users with job counts', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create([
        'name' => 'Process Owner',
        'email' => 'owner@example.com',
    ]);
    ProcessExecution::factory()->count(2)->for($user)->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    SocialAccount::factory()->for($user)->create(['provider' => 'orcid']);

    $this->actingAs($admin)
        ->get(route('admin.users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/users/index')
            ->has('users.data', 2)
            ->where('users.data.0.name', 'Process Owner')
            ->where('users.data.0.email', 'owner@example.com')
            ->where('users.data.0.role', UserRole::User->value)
            ->where('users.data.0.jobs_count', 2)
            ->has('users.data.0.socialProviders', 2)
            ->where('users.data.0.socialProviders.0.provider', 'google')
            ->where('users.data.0.socialProviders.0.label', 'GOOGLE')
            ->where('users.data.0.socialProviders.1.provider', 'orcid')
            ->where('users.data.0.socialProviders.1.label', 'ORCID')
        );
});

test('admins can create users with a password setup link', function () {
    Notification::fake();

    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post(route('admin.users.store'), [
            'name' => 'New Admin',
            'email' => 'New.Admin@Example.com',
            'role' => UserRole::Admin->value,
        ])
        ->assertRedirect(route('admin.users.index'));

    $user = User::query()->where('email', 'new.admin@example.com')->firstOrFail();

    expect($user->name)->toBe('New Admin')
        ->and($user->role)->toBe(UserRole::Admin)
        ->and($user->password)->toBeNull()
        ->and($user->email_verified_at)->not->toBeNull();

    Notification::assertSentTo($user, ResetPassword::class);
});

test('admin user creation supports precognitive validation', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->create(['email' => 'taken@example.com']);

    $this->actingAs($admin)
        ->withHeaders([
            'Accept' => 'application/json',
            'Precognition' => 'true',
            'Precognition-Validate-Only' => 'email',
        ])
        ->post(route('admin.users.store'), [
            'name' => 'Taken User',
            'email' => 'taken@example.com',
            'role' => UserRole::User->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    expect(User::query()->where('name', 'Taken User')->exists())->toBeFalse();
});

test('admins can update users but cannot demote themselves', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create();

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $user), [
            'name' => 'Updated User',
            'email' => 'Updated.User@Example.com',
            'email_confirmation' => 'updated.user@example.com',
            'role' => UserRole::Admin->value,
        ])
        ->assertRedirect(route('admin.users.index'));

    expect($user->fresh()->name)->toBe('Updated User')
        ->and($user->fresh()->email)->toBe('updated.user@example.com')
        ->and($user->fresh()->role)->toBe(UserRole::Admin);

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $admin), [
            'name' => $admin->name,
            'email' => $admin->email,
            'role' => UserRole::User->value,
        ])
        ->assertSessionHasErrors('role');

    expect($admin->fresh()->role)->toBe(UserRole::Admin);
});

test('admins must confirm changed user emails', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create(['email' => 'original@example.com']);

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $user), [
            'name' => $user->name,
            'email' => 'changed@example.com',
            'role' => UserRole::User->value,
        ])
        ->assertSessionHasErrors('email');

    expect($user->fresh()->email)->toBe('original@example.com');

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $user), [
            'name' => $user->name,
            'email' => 'changed@example.com',
            'email_confirmation' => 'other@example.com',
            'role' => UserRole::User->value,
        ])
        ->assertSessionHasErrors('email');

    expect($user->fresh()->email)->toBe('original@example.com');

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $user), [
            'name' => $user->name,
            'email' => 'Changed@Example.com',
            'email_confirmation' => 'changed@example.com',
            'role' => UserRole::User->value,
        ])
        ->assertRedirect(route('admin.users.index'));

    expect($user->fresh()->email)->toBe('changed@example.com');
});

test('admins can deactivate and restore users but cannot deactivate themselves', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create();

    DB::table('sessions')->insert([
        'id' => 'target-session',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Pest',
        'payload' => 'payload',
        'last_activity' => now()->timestamp,
    ]);

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $user))
        ->assertRedirect(route('admin.users.index'));

    expect($user->fresh()->isDeactivated())->toBeTrue()
        ->and(DB::table('sessions')->where('user_id', $user->id)->exists())->toBeFalse();

    $this->actingAs($admin)
        ->patch(route('admin.users.restore', $user))
        ->assertRedirect(route('admin.users.index'));

    expect($user->fresh()->isActive())->toBeTrue();

    $this->actingAs($admin)
        ->delete(route('admin.users.destroy', $admin))
        ->assertSessionHasErrors('user');

    expect($admin->fresh()->isActive())->toBeTrue();
});
