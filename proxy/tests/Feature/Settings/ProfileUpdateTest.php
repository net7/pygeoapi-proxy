<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('profile page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('profile.edit'));

    $response->assertOk();
});

test('profile page shares social provider avatar when no local avatar exists', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create([
        'avatar' => 'https://example.org/provider-avatar.png',
    ]);

    $this
        ->actingAs($user)
        ->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.avatar', 'https://example.org/provider-avatar.png')
        );
});

test('profile information can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    $user->refresh();

    expect($user->name)->toBe('Test User');
    expect($user->email)->toBe('test@example.com');
    expect($user->email_verified_at)->toBeNull();
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('profile avatar can be uploaded', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->post(route('profile.avatar.update'), [
            'avatar' => UploadedFile::fake()->image('avatar.jpg', 240, 240)->size(128),
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    $user->refresh();

    expect($user->avatar_path)->not->toBeNull()
        ->and(str_starts_with($user->avatar_path, 'avatars/'))->toBeTrue()
        ->and($user->avatar())->toBe(route('profile.avatar.show', ['path' => $user->avatar_path], absolute: false));

    Storage::disk('public')->assertExists($user->avatar_path);
});

test('profile avatar can be served over http', function () {
    Storage::disk('public')->put('avatars/local-avatar.jpg', 'avatar');

    $user = User::factory()->create([
        'avatar_path' => 'avatars/local-avatar.jpg',
    ]);

    $this
        ->actingAs($user)
        ->get($user->avatar())
        ->assertOk();
});

test('profile avatar can be removed to reveal provider avatar', function () {
    Storage::fake('public');
    Storage::disk('public')->put('avatars/local-avatar.jpg', 'avatar');

    $user = User::factory()->create([
        'avatar_path' => 'avatars/local-avatar.jpg',
    ]);
    SocialAccount::factory()->for($user)->create([
        'avatar' => 'https://example.org/provider-avatar.png',
    ]);

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.avatar.destroy'));

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->refresh()->avatar_path)->toBeNull()
        ->and($user->avatar())->toBe('https://example.org/provider-avatar.png');

    Storage::disk('public')->assertMissing('avatars/local-avatar.jpg');
});

test('user can delete their account', function () {
    config(['fortify.features' => [AuthFeatures::accountDeletion()]]);
    Storage::fake('public');
    Storage::disk('public')->put('avatars/local-avatar.jpg', 'avatar');

    $user = User::factory()->create([
        'avatar_path' => 'avatars/local-avatar.jpg',
    ]);

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
    Storage::disk('public')->assertMissing('avatars/local-avatar.jpg');
});

test('user cannot delete their account when account deletion is disabled', function () {
    config(['fortify.features' => []]);

    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ])
        ->assertNotFound();

    expect($user->fresh())->not->toBeNull();
});

test('social only user cannot delete their account when account deletion is disabled', function () {
    config(['fortify.features' => []]);

    $user = User::factory()->socialOnly()->create();

    $this
        ->actingAs($user)
        ->delete(route('profile.destroy'))
        ->assertNotFound();

    expect($user->fresh())->not->toBeNull();
});

test('correct password must be provided to delete account', function () {
    config(['fortify.features' => [AuthFeatures::accountDeletion()]]);

    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh())->not->toBeNull();
});
