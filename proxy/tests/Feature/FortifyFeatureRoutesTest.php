<?php

use App\Support\AuthFeatures;
use Inertia\Testing\AssertableInertia as Assert;

test('disabled optional fortify features share null frontend routes', function () {
    config(['fortify.features' => []]);

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.canRegister', false)
            ->where('auth.canResetPassword', false)
            ->where('auth.canUsePasskeys', false)
            ->where('auth.canUsePasswordLogin', false)
            ->where('auth.canDeleteAccount', false)
            ->where('auth.routes.register', null)
            ->where('auth.routes.passwordRequest', null)
            ->where('auth.routes.passkeyLogin', null)
            ->where('auth.routes.socialProviders', []),
        );
});

test('account deletion feature is shared with the frontend', function () {
    config(['fortify.features' => [AuthFeatures::accountDeletion()]]);

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.canDeleteAccount', true),
        );
});
