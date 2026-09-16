<?php

namespace App\Support;

use App\Enums\TableKey;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class UserTableSettings
{
    public const array PAGE_SIZES = [10, 20, 50];

    /**
     * @return array{columnVisibility: array<string, bool>, sorting: list<array{id: string, desc: bool}>, pageSize: int}
     */
    public function forUser(User $user, TableKey $table): array
    {
        $defaults = $table->defaults();
        $stored = $this->stored($user, $table);

        return [
            'columnVisibility' => array_replace($defaults['columnVisibility'], $stored['columnVisibility'] ?? []),
            'sorting' => $stored['sorting'] ?? $defaults['sorting'],
            'pageSize' => $stored['pageSize'] ?? $defaults['pageSize'],
        ];
    }

    /**
     * @return array{tables: array<string, mixed>}
     */
    public function sharedForUser(User $user): array
    {
        $tables = ['jobs' => $this->forUser($user, TableKey::Jobs)];

        if ($user->isAdmin()) {
            $tables['admin'] = [
                'jobs' => $this->forUser($user, TableKey::AdminJobs),
                'users' => $this->forUser($user, TableKey::AdminUsers),
            ];
        }

        return ['tables' => $tables];
    }

    /**
     * @param  array{columnVisibility?: array<string, bool>, sorting?: list<array{id: string, desc: bool}>, pageSize?: int}  $changes
     * @return array{columnVisibility: array<string, bool>, sorting: list<array{id: string, desc: bool}>, pageSize: int}
     */
    public function update(User $user, TableKey $table, array $changes): array
    {
        return DB::transaction(function () use ($user, $table, $changes): array {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->getKey());
            $settings = is_array($lockedUser->settings) ? $lockedUser->settings : [];
            $preferences = $this->stored($lockedUser, $table);

            if (array_key_exists('columnVisibility', $changes)) {
                $changes['columnVisibility'] = array_replace($preferences['columnVisibility'] ?? [], $changes['columnVisibility']);
            }

            Arr::set($settings, 'tables.'.$table->value, array_replace($preferences, $changes));
            $lockedUser->settings = $settings;
            $lockedUser->save();

            return $this->forUser($lockedUser, $table);
        }, 3);
    }

    /**
     * @return array{columnVisibility: array<string, bool>, sorting: list<array{id: string, desc: bool}>, pageSize: int}
     */
    public function reset(User $user, TableKey $table): array
    {
        return DB::transaction(function () use ($user, $table): array {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->getKey());
            $settings = is_array($lockedUser->settings) ? $lockedUser->settings : [];
            Arr::forget($settings, 'tables.'.$table->value);
            $lockedUser->settings = $settings === [] ? null : $settings;
            $lockedUser->save();

            return $this->forUser($lockedUser, $table);
        }, 3);
    }

    /**
     * @return array{columnVisibility?: array<string, bool>, sorting?: list<array{id: string, desc: bool}>, pageSize?: int}
     */
    private function stored(User $user, TableKey $table): array
    {
        $stored = data_get($user->settings, 'tables.'.$table->value);

        if (! is_array($stored)) {
            return [];
        }

        $preferences = [];

        if (is_array($stored['columnVisibility'] ?? null)) {
            $preferences['columnVisibility'] = array_filter(
                Arr::only($stored['columnVisibility'], $table->columns()),
                fn (mixed $visible): bool => is_bool($visible),
            );
        }

        if (is_array($stored['sorting'] ?? null) && array_is_list($stored['sorting'])) {
            $sorting = [];
            $seen = [];

            foreach ($stored['sorting'] as $sort) {
                if (! is_array($sort)
                    || ! in_array($sort['id'] ?? null, $table->columns(), true)
                    || ! is_bool($sort['desc'] ?? null)
                    || isset($seen[$sort['id']])) {
                    continue;
                }

                $sorting[] = ['id' => $sort['id'], 'desc' => $sort['desc']];
                $seen[$sort['id']] = true;
            }

            if ($sorting !== [] || $stored['sorting'] === []) {
                $preferences['sorting'] = $sorting;
            }
        }

        if (in_array($stored['pageSize'] ?? null, self::PAGE_SIZES, true)) {
            $preferences['pageSize'] = $stored['pageSize'];
        }

        return $preferences;
    }
}
