<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim($request->string('search')->toString());

        $users = User::query()
            ->with('socialAccounts:id,user_id,provider')
            ->withCount('processExecutions')
            ->when($search !== '', function ($query) use ($search): void {
                $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            })
            ->latest('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user): array => $this->userPayload($user));

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'roles' => $this->roles(),
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $user = new User;
        $user->forceFill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'email_verified_at' => now(),
            'password' => null,
            'role' => UserRole::from($validated['role']),
        ])->save();

        $status = Password::sendResetLink(['email' => $user->email]);

        if ($status !== Password::RESET_LINK_SENT) {
            return back()->withErrors(['email' => __($status)]);
        }

        return to_route('admin.users.index');
    }

    public function edit(User $user): Response
    {
        return Inertia::render('admin/users/edit', [
            'user' => $this->userPayload(
                $user
                    ->load('socialAccounts:id,user_id,provider')
                    ->loadCount('processExecutions')
            ),
            'roles' => $this->roles(),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $validated = $request->validated();

        $user->forceFill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => UserRole::from($validated['role']),
        ])->save();

        return to_route('admin.users.index');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($request->user()?->is($user) === true) {
            return back()->withErrors(['user' => __('You cannot deactivate your own account.')]);
        }

        $user->forceFill(['deactivated_at' => now()])->save();
        $this->invalidateUserSessions($user);

        return to_route('admin.users.index');
    }

    public function restore(User $user): RedirectResponse
    {
        $user->forceFill(['deactivated_at' => null])->save();

        return to_route('admin.users.index');
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    private function roles(): array
    {
        return array_map(
            fn (UserRole $role): array => [
                'value' => $role->value,
                'label' => str($role->value)->headline()->toString(),
            ],
            UserRole::cases(),
        );
    }

    /**
     * @return array{id: int, name: string, email: string, role: string, is_admin: bool, is_deactivated: bool, deactivated_at: string|null, socialProviders: list<array{provider: string, label: string}>, jobs_count: int, jobFilter: string, created_at: string|null}
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'is_admin' => $user->isAdmin(),
            'is_deactivated' => $user->isDeactivated(),
            'deactivated_at' => $user->deactivated_at?->toISOString(),
            'socialProviders' => $this->socialProviderPayload($user),
            'jobs_count' => (int) ($user->process_executions_count ?? 0),
            'jobFilter' => Crypt::encryptString((string) $user->id),
            'created_at' => $user->created_at?->toISOString(),
        ];
    }

    /**
     * @return list<array{provider: string, label: string}>
     */
    private function socialProviderPayload(User $user): array
    {
        return $user->socialAccounts
            ->pluck('provider')
            ->unique()
            ->sort()
            ->values()
            ->map(fn (string $provider): array => [
                'provider' => $provider,
                'label' => str($provider)->upper()->toString(),
            ])
            ->all();
    }

    private function invalidateUserSessions(User $user): void
    {
        DB::table('sessions')
            ->where('user_id', $user->id)
            ->delete();
    }
}
