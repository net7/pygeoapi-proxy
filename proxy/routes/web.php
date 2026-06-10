<?php

use App\Http\Controllers\Auth\EmailOtpChallengeController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\SocialEmailController;
use App\Http\Controllers\Ogc\ProcessController;
use App\Http\Controllers\Ogc\ProcessExecutionController;
use App\Http\Controllers\Ogc\ProcessExecutionResultController;
use App\Models\ProcessExecution;
use App\Models\ProcessExecutionResult;
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

    Route::get('processes', [ProcessController::class, 'index'])->name('processes.index');
    Route::get('processes/{process}', [ProcessController::class, 'show'])->name('processes.show');
    Route::post('processes/{process}/jobs', [ProcessExecutionController::class, 'store'])
        ->name('processes.jobs.store');
    Route::post('processes/{process}/executions', [ProcessExecutionController::class, 'store'])
        ->name('processes.executions.store');

    Route::get('jobs', [ProcessExecutionController::class, 'index'])
        ->name('jobs.index');
    Route::get('jobs/{processExecution}', [ProcessExecutionController::class, 'show'])
        ->name('jobs.show');
    Route::get('jobs/{processExecution}/results/{result}/download', [ProcessExecutionResultController::class, 'download'])
        ->name('jobs.results.download');

    Route::get('process-executions', fn () => to_route('jobs.index'))
        ->name('process-executions.index');
    Route::get('process-executions/{processExecution}', fn (ProcessExecution $processExecution) => to_route('jobs.show', $processExecution))
        ->name('process-executions.show');
    Route::get(
        'process-executions/{processExecution}/results/{result}/download',
        fn (ProcessExecution $processExecution, ProcessExecutionResult $result) => to_route('jobs.results.download', [$processExecution, $result])
    )
        ->name('process-executions.results.download');
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
