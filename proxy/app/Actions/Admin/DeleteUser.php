<?php

namespace App\Actions\Admin;

use App\Actions\Ogc\DeleteProcessExecution;
use App\Models\ProcessExecution;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DeleteUser
{
    public function __construct(private DeleteProcessExecution $deleteProcessExecution) {}

    public function handle(User $user): void
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
