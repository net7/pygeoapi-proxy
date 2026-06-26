<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;

#[Fillable(['name', 'email', 'password', 'avatar_path', 'role', 'deactivated_at'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable;

    /**
     * @return HasMany<SocialAccount>
     */
    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    /**
     * @return HasMany<ProcessExecution>
     */
    public function processExecutions(): HasMany
    {
        return $this->hasMany(ProcessExecution::class);
    }

    public function hasLocalPassword(): bool
    {
        return filled($this->password);
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function isActive(): bool
    {
        return $this->deactivated_at === null;
    }

    public function isDeactivated(): bool
    {
        return ! $this->isActive();
    }

    public function avatar(): ?string
    {
        if (filled($this->avatar_path)) {
            return route('profile.avatar.show', ['path' => $this->avatar_path], absolute: false);
        }

        $providerAvatar = $this->socialAccounts()
            ->whereNotNull('avatar')
            ->latest('updated_at')
            ->value('avatar');

        return $providerAvatar === null ? null : (string) $providerAvatar;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'deactivated_at' => 'datetime',
        ];
    }
}
