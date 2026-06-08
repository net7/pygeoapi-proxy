<?php

namespace App\Actions\Auth;

use App\Data\ProviderProfile;
use App\Data\SocialLoginResult;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SocialUserResolver
{
    public function resolve(ProviderProfile $profile): SocialLoginResult
    {
        $existingAccount = SocialAccount::query()
            ->where('provider', $profile->provider)
            ->where('provider_user_id', $profile->providerUserId)
            ->first();

        if ($existingAccount !== null) {
            $this->refreshProvider($existingAccount, $profile);

            return SocialLoginResult::authenticated($existingAccount->user);
        }

        if ($profile->emailVerified && $profile->normalizedEmail() !== null) {
            return DB::transaction(function () use ($profile): SocialLoginResult {
                $user = User::query()->firstOrCreate(
                    ['email' => $profile->normalizedEmail()],
                    [
                        'name' => $profile->name ?: $profile->normalizedEmail(),
                        'password' => null,
                        'email_verified_at' => now(),
                    ],
                );

                if ($user->email_verified_at === null) {
                    $user->forceFill(['email_verified_at' => now()])->save();
                }

                $this->linkProvider($user, $profile);

                return SocialLoginResult::authenticated($user);
            });
        }

        return SocialLoginResult::needsEmail($profile->toPayload());
    }

    public function completeVerifiedEmail(ProviderProfile $profile, string $email): User
    {
        return DB::transaction(function () use ($profile, $email): User {
            $normalizedEmail = Str::lower($email);

            $user = User::query()->firstOrCreate(
                ['email' => $normalizedEmail],
                [
                    'name' => $profile->name ?: $normalizedEmail,
                    'password' => null,
                    'email_verified_at' => now(),
                ],
            );

            $user->forceFill(['email_verified_at' => now()])->save();
            $this->linkProvider($user, $profile, $normalizedEmail, true);

            return $user;
        });
    }

    private function linkProvider(User $user, ProviderProfile $profile, ?string $verifiedEmail = null, ?bool $emailVerified = null): SocialAccount
    {
        return SocialAccount::query()->create([
            'user_id' => $user->id,
            'provider' => $profile->provider,
            'provider_user_id' => $profile->providerUserId,
            'provider_email' => $verifiedEmail ?? $profile->normalizedEmail(),
            'provider_email_verified' => $emailVerified ?? $profile->emailVerified,
            'name' => $profile->name,
            'avatar' => $profile->avatar,
            'raw_profile' => $profile->raw,
        ]);
    }

    private function refreshProvider(SocialAccount $account, ProviderProfile $profile): void
    {
        $normalizedEmail = $profile->normalizedEmail();

        $account->forceFill([
            'provider_email' => $normalizedEmail ?? $account->provider_email,
            'provider_email_verified' => $normalizedEmail !== null
                ? $profile->emailVerified
                : $account->provider_email_verified,
            'name' => $profile->name ?? $account->name,
            'avatar' => $profile->avatar ?? $account->avatar,
            'raw_profile' => $profile->raw,
        ])->save();
    }
}
