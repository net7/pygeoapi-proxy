<?php

use App\Models\User;

test('home redirects guests to login', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});

test('home redirects authenticated users to their jobs', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('home'))
        ->assertRedirect(route('jobs.index', absolute: false));
});
