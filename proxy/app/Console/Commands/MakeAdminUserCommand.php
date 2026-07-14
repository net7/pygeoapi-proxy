<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

use function Laravel\Prompts\error;
use function Laravel\Prompts\info;
use function Laravel\Prompts\search;

#[Signature('users:make-admin {email? : The existing user email address to promote}')]
#[Description('Promote an existing user to administrator')]
class MakeAdminUserCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $emailArgument = $this->argument('email');

        if ($emailArgument !== null) {
            $email = Str::lower(trim((string) $emailArgument));

            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                error('The email address is not valid.');

                return self::FAILURE;
            }

            $user = $this->findPromotableUserByEmail($email);
        } else {
            if (! $this->promotableUsersQuery()->exists()) {
                error('There are no non-admin users to promote.');

                return self::FAILURE;
            }

            $email = (string) search(
                label: 'Select the existing user to promote',
                options: fn (string $value): array => $this->searchPromotableUsers($value),
                placeholder: 'Type a name or email',
                scroll: 10,
                hint: 'Only existing non-admin users are shown.',
            );

            $user = $this->findPromotableUserByEmail(Str::lower($email));
        }

        if ($user === null) {
            error("No non-admin user found for {$email}.");

            return self::FAILURE;
        }

        $user->forceFill([
            'role' => UserRole::Admin,
            'deactivated_at' => null,
        ])->save();

        info('User promoted to administrator.');

        return self::SUCCESS;
    }

    /**
     * @return Builder<User>
     */
    private function promotableUsersQuery(): Builder
    {
        return User::query()->where('role', '!=', UserRole::Admin);
    }

    private function findPromotableUserByEmail(string $email): ?User
    {
        return $this->promotableUsersQuery()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();
    }

    /**
     * @return array<string, string>
     */
    private function searchPromotableUsers(string $search): array
    {
        $search = trim($search);

        return $this->promotableUsersQuery()
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(10)
            ->get(['name', 'email'])
            ->mapWithKeys(fn (User $user): array => [
                $user->email => "{$user->name} <{$user->email}>",
            ])
            ->all();
    }
}
