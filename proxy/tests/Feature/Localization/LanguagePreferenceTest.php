<?php

use App\Models\User;

test('language defaults to italian', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('valid language cookie sets html language', function () {
    $this->withUnencryptedCookie('language', 'en')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="en"', false);
});

test('invalid language cookie falls back to italian', function () {
    $this->withUnencryptedCookie('language', 'fr')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('inertia shares the current language', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withUnencryptedCookie('language', 'en')
        ->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('language', 'en'));
});
