<?php

use App\Enums\TableKey;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\SensitiveConfirmationController;
use App\Http\Controllers\Settings\TableSettingsController;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', EnsureUserIsActive::class])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('settings/profile/avatar', [ProfileController::class, 'updateAvatar'])->name('profile.avatar.update');
    Route::delete('settings/profile/avatar', [ProfileController::class, 'destroyAvatar'])->name('profile.avatar.destroy');
    Route::get('settings/profile/avatar/{path}', [ProfileController::class, 'showAvatar'])
        ->where('path', '.*')
        ->name('profile.avatar.show');
});

Route::middleware(['auth', EnsureUserIsActive::class, 'verified'])->group(function () {
    Route::patch('settings/tables/jobs', [TableSettingsController::class, 'update'])
        ->defaults('table', TableKey::Jobs->value)
        ->name('settings.tables.jobs.update');
    Route::delete('settings/tables/jobs', [TableSettingsController::class, 'destroy'])
        ->defaults('table', TableKey::Jobs->value)
        ->name('settings.tables.jobs.destroy');

    Route::middleware(EnsureUserIsAdmin::class)->group(function () {
        Route::patch('settings/admin/tables/jobs', [TableSettingsController::class, 'update'])
            ->defaults('table', TableKey::AdminJobs->value)
            ->name('settings.admin.tables.jobs.update');
        Route::delete('settings/admin/tables/jobs', [TableSettingsController::class, 'destroy'])
            ->defaults('table', TableKey::AdminJobs->value)
            ->name('settings.admin.tables.jobs.destroy');
        Route::patch('settings/admin/tables/users', [TableSettingsController::class, 'update'])
            ->defaults('table', TableKey::AdminUsers->value)
            ->name('settings.admin.tables.users.update');
        Route::delete('settings/admin/tables/users', [TableSettingsController::class, 'destroy'])
            ->defaults('table', TableKey::AdminUsers->value)
            ->name('settings.admin.tables.users.destroy');
    });

    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::post('settings/sensitive-confirmation', [SensitiveConfirmationController::class, 'send'])
        ->middleware('throttle:3,1')
        ->name('settings.sensitive-confirmation.send');

    Route::redirect('settings/security', '/settings/profile')->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');
});
