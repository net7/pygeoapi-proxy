<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

#[Signature('users:make-admin {email : The user email address} {--name= : The name to use when creating a new user}')]
#[Description('Create or promote an administrator user')]
class MakeAdminUserCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = Str::lower(trim((string) $this->argument('email')));

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $this->error('The email address is not valid.');

            return self::FAILURE;
        }

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        $created = $user === null;

        if ($created) {
            $name = trim((string) $this->option('name'));

            $user = new User;
            $user->forceFill([
                'name' => $name !== '' ? $name : $email,
                'email' => $email,
                'email_verified_at' => now(),
                'password' => null,
                'role' => UserRole::Admin,
            ])->save();
        } else {
            $user->forceFill([
                'role' => UserRole::Admin,
                'deactivated_at' => null,
            ])->save();
        }

        if ($created) {
            $status = Password::sendResetLink(['email' => $user->email]);

            if ($status !== Password::RESET_LINK_SENT) {
                $this->error(__($status));

                return self::FAILURE;
            }
        }

        $this->info($created ? 'Administrator user created.' : 'User promoted to administrator.');

        return self::SUCCESS;
    }
}
