<?php

use Illuminate\Support\Facades\Route;

test('dashboard route is not registered', function () {
    $this->get('/dashboard')->assertNotFound();
});

test('dashboard named route is not available', function () {
    expect(Route::has('dashboard'))->toBeFalse();
});
