<?php

namespace App\Enums;

enum TableKey: string
{
    case Jobs = 'jobs';
    case AdminJobs = 'admin.jobs';
    case AdminUsers = 'admin.users';

    /**
     * @return list<string>
     */
    public function columns(): array
    {
        return match ($this) {
            self::Jobs => ['process', 'status', 'jobId', 'message', 'createdAt', 'submittedAt', 'finishedAt', 'progress'],
            self::AdminJobs => ['user', 'process', 'status', 'jobId', 'message', 'submittedAt', 'finishedAt', 'progress'],
            self::AdminUsers => ['user', 'role', 'socialProviders', 'status', 'jobs_count', 'first_access_completed_at', 'created_at'],
        };
    }

    /**
     * @return array{columnVisibility: array<string, bool>, sorting: list<array{id: string, desc: bool}>, pageSize: int}
     */
    public function defaults(): array
    {
        return match ($this) {
            self::Jobs => [
                'columnVisibility' => ['finishedAt' => false, 'message' => false, 'submittedAt' => false],
                'sorting' => [['id' => 'createdAt', 'desc' => true]],
                'pageSize' => 10,
            ],
            self::AdminJobs => [
                'columnVisibility' => ['finishedAt' => false, 'message' => false],
                'sorting' => [['id' => 'submittedAt', 'desc' => true]],
                'pageSize' => 10,
            ],
            self::AdminUsers => [
                'columnVisibility' => [],
                'sorting' => [['id' => 'created_at', 'desc' => true]],
                'pageSize' => 10,
            ],
        };
    }
}
