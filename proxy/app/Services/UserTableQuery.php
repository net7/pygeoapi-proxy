<?php

namespace App\Services;

use App\Models\User;
use App\Support\TablePagination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

class UserTableQuery
{
    /**
     * @param  array{search: string, status: string, role: string}  $filters
     * @param  array{sorting: list<array{id: string, desc: bool}>, pageSize: int, columnVisibility: array<string, bool>}  $settings
     * @return array{users: LengthAwarePaginator<int, User>, statusCounts: array<string, int>, roleCounts: array<string, int>}
     */
    public function paginate(array $filters, array $settings, int $page): array
    {
        $query = User::query();
        if ($filters['search'] !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($filters['search'])).'%';
            $query->where(function (Builder $query) use ($pattern): void {
                foreach (['name', 'email', 'role'] as $column) {
                    $query->orWhereRaw("LOWER({$column}) LIKE ? ESCAPE '!'", [$pattern]);
                }
                $query->orWhereRaw("(CASE WHEN deactivated_at IS NULL THEN 'active' ELSE 'inactive' END) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereHas('socialAccounts', fn (Builder $query) => $query->whereRaw("LOWER(provider) LIKE ? ESCAPE '!'", [$pattern]));
            });
        }

        $statuses = clone $query;
        $this->filterRole($statuses, $filters['role']);
        $statusCounts = $statuses->selectRaw("CASE WHEN deactivated_at IS NULL THEN 'active' ELSE 'inactive' END as status, count(*) as aggregate")
            ->groupBy('status')->pluck('aggregate', 'status')->map(fn ($count): int => (int) $count)->all();
        $roles = clone $query;
        $this->filterStatus($roles, $filters['status']);
        $roleCounts = $roles->selectRaw('role, count(*) as aggregate')->groupBy('role')
            ->pluck('aggregate', 'role')->map(fn ($count): int => (int) $count)->all();

        $this->filterRole($query, $filters['role']);
        $this->filterStatus($query, $filters['status']);
        $query->with('socialAccounts:id,user_id,provider,avatar,updated_at')->withCount('processExecutions');
        $this->sort($query, $settings['sorting']);

        return [
            'users' => TablePagination::paginate($query, $settings['pageSize'], $page),
            'statusCounts' => array_replace(['active' => 0, 'inactive' => 0], $statusCounts),
            'roleCounts' => array_replace(['admin' => 0, 'user' => 0], $roleCounts),
        ];
    }

    /** @param Builder<User> $query */
    private function filterRole(Builder $query, string $role): void
    {
        if ($role !== 'all') {
            $query->where('role', $role);
        }
    }

    /** @param Builder<User> $query */
    private function filterStatus(Builder $query, string $status): void
    {
        if ($status === 'active') {
            $query->whereNull('deactivated_at');
        } elseif ($status === 'inactive') {
            $query->whereNotNull('deactivated_at');
        }
    }

    /**
     * @param  Builder<User>  $query
     * @param  list<array{id: string, desc: bool}>  $sorting
     */
    private function sort(Builder $query, array $sorting): void
    {
        $sqlite = $query->getConnection()->getDriverName() === 'sqlite';
        $name = $sqlite ? "name || ' ' || email" : "CONCAT(name, ' ', email)";
        $providers = $sqlite
            ? "(SELECT group_concat(provider, ' ') FROM (SELECT DISTINCT provider FROM social_accounts WHERE social_accounts.user_id = users.id ORDER BY provider))"
            : "(SELECT GROUP_CONCAT(DISTINCT provider ORDER BY provider SEPARATOR ' ') FROM social_accounts WHERE social_accounts.user_id = users.id)";
        $columns = [
            'user' => "LOWER({$name})",
            'role' => 'role',
            'socialProviders' => "LOWER(COALESCE({$providers}, 'LOCAL'))",
            'status' => "CASE WHEN deactivated_at IS NULL THEN 'active' ELSE 'inactive' END",
            'jobs_count' => 'process_executions_count',
            'first_access_completed_at' => 'first_access_completed_at',
            'created_at' => 'created_at',
        ];
        foreach ($sorting as $sort) {
            if (isset($columns[$sort['id']])) {
                $direction = $sort['desc'] ? 'desc' : 'asc';
                $query->orderByRaw($columns[$sort['id']].' '.$direction);
            }
        }
        $query->orderByDesc('id');
    }
}
