<?php

use App\Support\AuthFeatures;

test('social auth features can be enabled through fortify features config', function () {
    config(['fortify.features' => [
        AuthFeatures::google(),
        AuthFeatures::emailOtp(),
        AuthFeatures::passwordLogin(),
    ]]);

    expect(AuthFeatures::enabled(AuthFeatures::google()))->toBeTrue()
        ->and(AuthFeatures::enabled(AuthFeatures::orcid()))->toBeFalse()
        ->and(AuthFeatures::enabled(AuthFeatures::emailOtp()))->toBeTrue()
        ->and(AuthFeatures::enabled(AuthFeatures::passwordLogin()))->toBeTrue();
});

test('enabled social providers returns only configured providers', function () {
    config(['fortify.features' => [
        AuthFeatures::orcid(),
    ]]);

    expect(AuthFeatures::enabledProviders())->toBe(['orcid']);
});
