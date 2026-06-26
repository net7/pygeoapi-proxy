<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProcessExecution;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class JobController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim($request->string('search')->toString());
        $selectedUserId = $request->filled('user_id')
            ? $request->integer('user_id')
            : null;

        $users = User::query()
            ->orderBy('name')
            ->orderBy('email')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])
            ->all();

        $executions = ProcessExecution::query()
            ->with('user:id,name,email')
            ->when($selectedUserId !== null, function ($query) use ($selectedUserId): void {
                $query->where('user_id', $selectedUserId);
            })
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('process_id', 'like', "%{$search}%")
                        ->orWhere('process_title', 'like', "%{$search}%")
                        ->orWhere('remote_job_id', 'like', "%{$search}%")
                        ->orWhereHas('user', function ($query) use ($search): void {
                            $query
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        });
                });
            })
            ->latest()
            ->paginate(15)
            ->withQueryString()
            ->through(fn (ProcessExecution $execution): array => [
                'id' => $execution->id,
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
                ],
            ]);

        return Inertia::render('admin/jobs/index', [
            'executions' => $executions,
            'users' => $users,
            'filters' => [
                'search' => $search,
                'user_id' => $selectedUserId,
            ],
        ]);
    }
}
