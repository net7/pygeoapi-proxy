<?php

use App\Models\User;
use App\Support\AuthFeatures;

test('password login is disabled unless the feature is enabled', function () {
    config(['fortify.features' => []]);

    $user = User::factory()->create(['email' => 'ada@example.org']);

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('password login works when the feature is enabled', function () {
    config(['fortify.features' => [AuthFeatures::passwordLogin()]]);

    $user = User::factory()->create(['email' => 'ada@example.org']);

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('jobs.index', absolute: false));

    $this->assertAuthenticatedAs($user);
});
