<?php

namespace App\Actions\Admin;

use App\Actions\Ogc\DeleteProcessExecution;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DeleteUser
{
    public function __construct(
        private DeleteProcessExecution $deleteProcessExecution,
        private SupportContactManager $contacts,
    ) {}

    public function handle(User $user): void
    {
        $failure = $this->contacts->guardAccountChange(
            [$user->id],
            'user',
            function () use ($user): ConnectionException|RequestException|null {
                try {
                    $this->deleteAccount($user);
                } catch (ConnectionException|RequestException $exception) {
                    // Keep completed deletions committed: their remote effects cannot be rolled back.
                    return $exception;
                }

                return null;
            },
        );

        if ($failure !== null) {
            throw $failure;
        }
    }

    private function deleteAccount(User $user): void
    {
        $user->processExecutions()
            ->orderBy('id')
            ->lazyById()
            ->each(function (ProcessExecution $execution): void {
                $this->deleteProcessExecution->handle($execution);
            });

        DB::table((string) config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->delete();

        if (filled($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $user->delete();
    }
}
