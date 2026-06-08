<?php

use App\Http\Controllers\Auth\EmailOtpChallengeController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\SocialEmailController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware('guest')->group(function () {
    Route::get('auth/{provider}/redirect', [SocialAuthController::class, 'redirect'])
        ->whereIn('provider', ['google', 'orcid'])
        ->name('auth.social.redirect');

    Route::get('auth/{provider}/callback', [SocialAuthController::class, 'callback'])
        ->whereIn('provider', ['google', 'orcid'])
        ->name('auth.social.callback');

    Route::get('auth/social/email', [SocialEmailController::class, 'create'])
        ->name('auth.social.email.create');

    Route::post('auth/social/email', [SocialEmailController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('auth.social.email.store');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

Route::get('verify/{challenge}', [EmailOtpChallengeController::class, 'show'])
    ->middleware('signed')
    ->name('auth.otp.show');

Route::post('verify/{challenge}', [EmailOtpChallengeController::class, 'verify'])
    ->middleware('throttle:5,1')
    ->name('auth.otp.verify');

Route::post('verify/{challenge}/resend', [EmailOtpChallengeController::class, 'resend'])
    ->middleware('throttle:3,1')
    ->name('auth.otp.resend');

require __DIR__.'/settings.php';
