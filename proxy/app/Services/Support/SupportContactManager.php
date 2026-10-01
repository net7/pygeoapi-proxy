<?php

namespace App\Services\Support;

use App\Enums\UserRole;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

class SupportContactManager
{
    public function current(): ?User
    {
        return User::query()
            ->where('id', DB::table('support_settings')->where('id', 1)->value('technical_contact_user_id'))
            ->where('role', UserRole::Admin->value)
            ->whereNull('deactivated_at')
            ->first();
    }

    public function assign(int $userId): User
    {
        return DB::transaction(function () use ($userId): User {
            $this->lockSettings();
            $user = User::query()->whereKey($userId)->lockForUpdate()->first();

            if ($user === null || ! $user->isAdmin() || ! $user->isActive()) {
                throw ValidationException::withMessages([
                    'user' => __('The technical contact must be an active administrator.'),
                ]);
            }

            DB::table('support_settings')->where('id', 1)->update([
                'technical_contact_user_id' => $user->id,
            ]);

            return $user;
        });
    }

    /**
     * @param  list<int>  $userIds
     */
    public function guardAccountChange(array $userIds, string $errorField, Closure $change): mixed
    {
        return DB::transaction(function () use ($userIds, $errorField, $change): mixed {
            $settings = $this->lockSettings();
            User::query()->whereIn('id', $userIds)->orderBy('id')->lockForUpdate()->get();

            if ($settings->technical_contact_user_id !== null
                && in_array((int) $settings->technical_contact_user_id, $userIds, true)) {
                throw ValidationException::withMessages([
                    $errorField => __('Assign another technical contact before changing this account.'),
                ]);
            }

            return $change();
        }, attempts: 1);
    }

    private function lockSettings(): object
    {
        return DB::table('support_settings')->where('id', 1)->lockForUpdate()->first()
            ?? throw new LogicException('Missing support settings singleton.');
    }
}
