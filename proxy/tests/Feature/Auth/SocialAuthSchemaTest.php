<?php

use App\Models\EmailOtpChallenge;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

test('social auth tables are migrated', function () {
    expect(Schema::hasTable('social_accounts'))->toBeTrue()
        ->and(Schema::hasTable('email_otp_challenges'))->toBeTrue()
        ->and(Schema::hasColumn('users', 'password'))->toBeTrue();
});

test('user can have social accounts and nullable password', function () {
    $user = User::factory()->socialOnly()->create();

    $account = SocialAccount::factory()
        ->for($user)
        ->create([
            'provider' => 'google',
            'provider_user_id' => 'google-123',
        ]);

    expect($user->password)->toBeNull()
        ->and($user->socialAccounts()->first()->is($account))->toBeTrue()
        ->and($account->user->is($user))->toBeTrue()
        ->and($user->hasLocalPassword())->toBeFalse();
});

test('social account provider identity is unique', function () {
    $user = User::factory()->create();

    SocialAccount::factory()
        ->for($user)
        ->create([
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
        ]);

    expect(fn () => SocialAccount::factory()
        ->for($user)
        ->create([
            'provider' => 'orcid',
            'provider_user_id' => '0000-0002-1825-0097',
        ]))->toThrow(QueryException::class);
});

test('otp challenge uses uuid as route key and casts payload', function () {
    $challenge = EmailOtpChallenge::factory()->create([
        'payload' => ['provider' => 'orcid'],
    ]);

    expect($challenge->getRouteKeyName())->toBe('uuid')
        ->and($challenge->payload)->toBe(['provider' => 'orcid']);
});
