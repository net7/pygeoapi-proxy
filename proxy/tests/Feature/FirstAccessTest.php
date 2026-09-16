<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('new users receive an incomplete first access in shared props', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.first_access_completed_at', null)
        );
});

test('closing the guide completes only the authenticated users first access', function () {
    $this->freezeSecond();
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('first-access.complete'), [
            'user_id' => $otherUser->id,
            'first_access_completed_at' => '2000-01-01 00:00:00',
        ])
        ->assertNoContent();

    expect($user->refresh()->first_access_completed_at->equalTo(now()))->toBeTrue();
    expect($otherUser->refresh()->first_access_completed_at)->toBeNull();

    $this->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.first_access_completed_at', now()->toJSON())
        );
});

test('opening and closing help again preserves the original completion date', function () {
    $this->freezeSecond();
    $completedAt = now()->subDay();
    $user = User::factory()->create(['first_access_completed_at' => $completedAt]);

    $this->actingAs($user)->patchJson(route('first-access.complete'))->assertNoContent();

    expect($user->refresh()->first_access_completed_at->equalTo($completedAt))->toBeTrue();
});

test('guests cannot complete a users first access', function () {
    $this->patchJson(route('first-access.complete'))->assertUnauthorized();
});

test('deactivated users cannot complete their first access', function () {
    $user = User::factory()->deactivated()->create();

    $this->actingAs($user)->patchJson(route('first-access.complete'))
        ->assertRedirect(route('account.deactivated'));

    expect($user->refresh()->first_access_completed_at)->toBeNull();
});
