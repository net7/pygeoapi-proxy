<?php

use App\Enums\UserRole;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('inertia shares role flags for administrators', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.role', UserRole::Admin->value)
            ->where('auth.user.is_admin', true)
            ->where('auth.user.is_deactivated', false)
        );
});

test('inertia shares role flags for regular users', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.role', UserRole::User->value)
            ->where('auth.user.is_admin', false)
            ->where('auth.user.is_deactivated', false)
        );
});
