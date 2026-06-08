<?php

use App\Actions\Auth\SocialUserResolver;
use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('existing social account resolves authenticated user', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create([
        'provider' => 'google',
        'provider_user_id' => 'google-1',
    ]);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-1',
        name: 'Ada Lovelace',
        email: 'ada@example.org',
        emailVerified: true,
        avatar: null,
        raw: ['sub' => 'google-1'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->is($user))->toBeTrue();
});

test('existing social account refreshes provider avatar', function () {
    $user = User::factory()->create();
    $account = SocialAccount::factory()->for($user)->create([
        'provider' => 'google',
        'provider_user_id' => 'google-1',
        'avatar' => 'https://example.org/old-avatar.png',
    ]);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-1',
        name: 'Ada Lovelace',
        email: 'ada@example.org',
        emailVerified: true,
        avatar: 'https://example.org/new-avatar.png',
        raw: ['sub' => 'google-1'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->is($user))->toBeTrue()
        ->and($account->refresh()->avatar)->toBe('https://example.org/new-avatar.png');
});

test('verified email links provider to existing user', function () {
    $user = User::factory()->create(['email' => 'ada@example.org']);

    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-2',
        name: 'Ada Lovelace',
        email: 'ADA@example.org',
        emailVerified: true,
        avatar: 'https://example.org/avatar.png',
        raw: ['sub' => 'google-2'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->is($user))->toBeTrue()
        ->and($user->socialAccounts()->where('provider', 'google')->exists())->toBeTrue();
});

test('verified new email creates social only user', function () {
    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'google',
        providerUserId: 'google-3',
        name: 'Grace Hopper',
        email: 'grace@example.org',
        emailVerified: true,
        avatar: null,
        raw: ['sub' => 'google-3'],
    ));

    expect($result->status)->toBe(SocialLoginResult::Authenticated)
        ->and($result->user->email)->toBe('grace@example.org')
        ->and($result->user->password)->toBeNull()
        ->and($result->user->email_verified_at)->not->toBeNull();
});

test('missing trusted email requires email collection', function () {
    $result = app(SocialUserResolver::class)->resolve(new ProviderProfile(
        provider: 'orcid',
        providerUserId: '0000-0002-1825-0097',
        name: 'Researcher',
        email: null,
        emailVerified: false,
        avatar: null,
        raw: ['orcid' => '0000-0002-1825-0097'],
    ));

    expect($result->status)->toBe(SocialLoginResult::NeedsEmail)
        ->and($result->pendingProfile)->toBeArray();
});
