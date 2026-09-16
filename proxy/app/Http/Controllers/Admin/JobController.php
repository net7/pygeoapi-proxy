<?php

namespace App\Http\Controllers\Admin;

use App\Enums\TableKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\TableIndexRequest;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\JobTableQuery;
use App\Support\UserTableSettings;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Inertia\Inertia;
use Inertia\Response;

class JobController extends Controller
{
    public function index(TableIndexRequest $request, UserTableSettings $preferences, JobTableQuery $tableQuery): Response
    {
        $viewer = $request->user();
        assert($viewer instanceof User);
        $filters = $request->filters();
        $settings = $preferences->forUser($viewer, TableKey::AdminJobs);
        $selectedUserId = $this->selectedUserId($request);

        $users = User::query()
            ->orderBy('name')
            ->orderBy('email')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'jobFilter' => Crypt::encryptString((string) $user->id),
            ])
            ->all();

        $table = $tableQuery->paginate($viewer, TableKey::AdminJobs, $filters, $settings, $request->integer('page', 1), $selectedUserId);
        $executions = $table['executions']
            ->through(fn (ProcessExecution $execution): array => [
                'id' => $execution->id,
                'name' => $execution->name,
                'displayName' => $execution->displayName(),
                'remoteJobId' => $execution->remote_job_id,
                'processId' => $execution->process_id,
                'processTitle' => $execution->process_title,
                'status' => $execution->status->value,
                'progress' => $execution->progress,
                'message' => $execution->message,
                'createdAt' => $execution->created_at?->toIso8601String(),
                'submittedAt' => $execution->submitted_at?->toIso8601String(),
                'completedAt' => $execution->completed_at?->toIso8601String(),
                'failedAt' => $execution->failed_at?->toIso8601String(),
                'owner' => [
                    'id' => $execution->user->id,
                    'name' => $execution->user->name,
                    'email' => $execution->user->email,
                    'avatar' => $execution->user->avatar(),
                ],
            ]);

        return Inertia::render('admin/jobs/index', [
            'executions' => $executions,
            'users' => $users,
            'tableSettings' => $settings,
            'tableDefaults' => TableKey::AdminJobs->defaults(),
            'statusCounts' => $table['statusCounts'],
            'filters' => [
                'search' => $filters['search'],
                'status' => $filters['status'],
                'selectedUserId' => $selectedUserId,
            ],
        ]);
    }

    private function selectedUserId(Request $request): ?int
    {
        $filter = trim($request->string('user')->toString());

        if ($filter === '') {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($filter);
        } catch (DecryptException) {
            abort(404);
        }

        if (! ctype_digit($decrypted)) {
            abort(404);
        }

        return (int) $decrypted;
    }
}
