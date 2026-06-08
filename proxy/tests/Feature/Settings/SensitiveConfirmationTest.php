<?php

use App\Models\EmailOtpChallenge;
use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

test('social only user can request sensitive confirmation otp', function () {
    config(['fortify.features' => [AuthFeatures::emailOtp()]]);
    Notification::fake();

    $user = User::factory()->socialOnly()->create(['email' => 'social@example.org']);

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->post(route('settings.sensitive-confirmation.send'))
        ->assertRedirect(route('profile.edit'));

    $this->assertDatabaseHas('email_otp_challenges', [
        'email' => 'social@example.org',
        'purpose' => EmailOtpChallenge::PurposeSensitiveConfirmation,
    ]);
});

test('social only user cannot delete account without otp confirmation', function () {
    $user = User::factory()->socialOnly()->create();

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'))
        ->assertSessionHasErrors('otp')
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh())->not->toBeNull();
});

test('social only user can delete account after otp confirmation', function () {
    $user = User::factory()->socialOnly()->create(['email' => 'social@example.org']);
    $challenge = EmailOtpChallenge::factory()->create([
        'email' => 'social@example.org',
        'purpose' => EmailOtpChallenge::PurposeSensitiveConfirmation,
        'code_hash' => Hash::make('123456'),
    ]);

    $this->actingAs($user)
        ->post(route('auth.otp.verify', ['challenge' => $challenge]), ['code' => '123456'])
        ->assertRedirect(route('profile.edit', absolute: false));

    $this->delete(route('profile.destroy'))
        ->assertRedirect(route('home'));

    expect($user->fresh())->toBeNull();
});

test('password user still needs password to delete account', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'wrong-password'])
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));
});

test('password user cannot request sensitive confirmation otp', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('settings.sensitive-confirmation.send'))
        ->assertNotFound();
});
