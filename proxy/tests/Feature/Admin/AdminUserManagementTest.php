<?php

use App\Enums\UserRole;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
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
    Storage::fake('public');
    Storage::disk('public')->put('avatars/process-owner.jpg', 'avatar');

    $admin = User::factory()->admin()->create();
    $user = User::factory()->create([
        'name' => 'Process Owner',
        'email' => 'owner@example.com',
        'avatar_path' => 'avatars/process-owner.jpg',
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
            ->where('users.data.0.avatar', route('profile.avatar.show', ['path' => 'avatars/process-owner.jpg'], absolute: false))
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
        ->assertJsonValidationErrors('email')
        ->assertJsonPath('errors.email.0', 'The email has already been taken.');

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

test('admins can bulk deactivate users and invalidate their sessions', function () {
    $admin = User::factory()->admin()->create();
    $firstUser = User::factory()->create();
    $secondUser = User::factory()->create();

    DB::table('sessions')->insert([
        [
            'id' => 'first-bulk-session',
            'user_id' => $firstUser->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Pest',
            'payload' => 'payload',
            'last_activity' => now()->timestamp,
        ],
        [
            'id' => 'second-bulk-session',
            'user_id' => $secondUser->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Pest',
            'payload' => 'payload',
            'last_activity' => now()->timestamp,
        ],
    ]);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.bulk-destroy'), [
            'ids' => [$firstUser->id, $secondUser->id],
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertInertiaFlash('toast.title', 'Users deactivated')
        ->assertInertiaFlash('toast.details.0.value', '2');

    expect($firstUser->fresh()->isDeactivated())->toBeTrue()
        ->and($secondUser->fresh()->isDeactivated())->toBeTrue()
        ->and(DB::table('sessions')->whereIn('user_id', [$firstUser->id, $secondUser->id])->exists())->toBeFalse();
});

test('admins can bulk restore users', function () {
    $admin = User::factory()->admin()->create();
    $firstUser = User::factory()->create(['deactivated_at' => now()]);
    $secondUser = User::factory()->create(['deactivated_at' => now()]);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->patch(route('admin.users.bulk-restore'), [
            'ids' => [$firstUser->id, $secondUser->id],
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertInertiaFlash('toast.title', 'Users restored')
        ->assertInertiaFlash('toast.details.0.value', '2');

    expect($firstUser->fresh()->isActive())->toBeTrue()
        ->and($secondUser->fresh()->isActive())->toBeTrue();
});

test('admins cannot include themselves in bulk user status actions', function () {
    $admin = User::factory()->admin()->create();
    $target = User::factory()->create();

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.bulk-destroy'), [
            'ids' => [$admin->id, $target->id],
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertSessionHasErrors('user');

    expect($admin->fresh()->isActive())->toBeTrue()
        ->and($target->fresh()->isActive())->toBeTrue();

    $admin->forceFill(['deactivated_at' => null])->save();
    $target->forceFill(['deactivated_at' => now()])->save();

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->patch(route('admin.users.bulk-restore'), [
            'ids' => [$admin->id, $target->id],
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertSessionHasErrors('user');

    expect($admin->fresh()->isActive())->toBeTrue()
        ->and($target->fresh()->isDeactivated())->toBeTrue();
});

test('admins can permanently delete users and all related data', function () {
    config(['services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/']);
    Http::preventStrayRequests();
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-one' => Http::response(null, 204),
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-missing' => Http::response(['description' => 'Missing'], 404),
    ]);

    Storage::fake('public');
    Storage::disk('public')->put('avatars/target.jpg', 'avatar');

    $admin = User::factory()->admin()->create();
    $user = User::factory()->create([
        'email' => 'target@example.com',
        'avatar_path' => 'avatars/target.jpg',
    ]);
    $remoteExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-one']);
    $missingRemoteExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-missing']);
    $localExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => null]);
    ProcessExecutionResult::factory()->for($remoteExecution)->create();
    SocialAccount::factory()->for($user)->create();
    DB::table('passkeys')->insert([
        'user_id' => $user->id,
        'name' => 'Target passkey',
        'credential_id' => 'target-passkey-credential',
        'credential' => json_encode(['id' => 'target-passkey-credential']),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('sessions')->insert([
        'id' => 'force-delete-target-session',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Pest',
        'payload' => 'payload',
        'last_activity' => now()->timestamp,
    ]);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $user), [
            'email_confirmation' => 'target@example.com',
        ])
        ->assertRedirect(route('admin.users.index'));

    $this->assertModelMissing($user);
    $this->assertDatabaseMissing('process_executions', ['id' => $remoteExecution->id]);
    $this->assertDatabaseMissing('process_executions', ['id' => $missingRemoteExecution->id]);
    $this->assertDatabaseMissing('process_executions', ['id' => $localExecution->id]);
    $this->assertDatabaseMissing('sessions', ['id' => 'force-delete-target-session']);
    $this->assertDatabaseMissing('social_accounts', ['user_id' => $user->id]);
    $this->assertDatabaseMissing('passkeys', ['user_id' => $user->id]);
    Storage::disk('public')->assertMissing('avatars/target.jpg');

    Http::assertSent(fn (Request $request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/jobs/remote-one');
    Http::assertSent(fn (Request $request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://voice.pi.ingv.it/geoinquire/jobs/remote-missing');
});

test('permanent user deletion requires matching email confirmation', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create(['email' => 'target@example.com']);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $user), [
            'email_confirmation' => 'wrong@example.com',
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertSessionHasErrors('email_confirmation');

    $this->assertModelExists($user);
});

test('admins cannot permanently delete themselves', function () {
    $admin = User::factory()->admin()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $admin), [
            'email_confirmation' => 'admin@example.com',
        ])
        ->assertRedirect(route('admin.users.index'))
        ->assertSessionHasErrors('user');

    $this->assertModelExists($admin);
});

test('remote job deletion failure stops permanent user deletion', function () {
    config(['services.ogc_processes.base_url' => 'https://voice.pi.ingv.it/geoinquire/']);
    Http::preventStrayRequests();
    Http::fake([
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-one' => Http::response(null, 204),
        'https://voice.pi.ingv.it/geoinquire/jobs/remote-failing' => Http::response(['description' => 'Unavailable'], 500),
    ]);

    $admin = User::factory()->admin()->create();
    $user = User::factory()->create(['email' => 'target@example.com']);
    $deletedExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-one']);
    $failingExecution = ProcessExecution::factory()->for($user)->create(['remote_job_id' => 'remote-failing']);

    $this->actingAs($admin)
        ->from(route('admin.users.index'))
        ->delete(route('admin.users.force-destroy', $user), [
            'email_confirmation' => 'target@example.com',
        ])
        ->assertRedirect(route('admin.users.index'));

    $this->assertModelExists($user);
    $this->assertDatabaseMissing('process_executions', ['id' => $deletedExecution->id]);
    $this->assertDatabaseHas('process_executions', ['id' => $failingExecution->id]);
});

test('normal users cannot permanently delete users', function () {
    $user = User::factory()->create();
    $target = User::factory()->create(['email' => 'target@example.com']);

    $this->actingAs($user)
        ->delete(route('admin.users.force-destroy', $target), [
            'email_confirmation' => 'target@example.com',
        ])
        ->assertForbidden();

    $this->assertModelExists($target);
});
