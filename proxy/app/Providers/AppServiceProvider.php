<?php

namespace App\Providers;

use App\Jobs\SendSupportEmail;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use Carbon\CarbonImmutable;
use Illuminate\Queue\Queue;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(OgcProcessCacheWarmupDispatcher $warmupDispatcher): void
    {
        $this->configureUrlScheme();
        $this->configureDefaults();
        Queue::createPayloadUsing(function ($connection, $queue, array $payload): array {
            $job = $payload['data']['command'] ?? null;

            return $job instanceof SendSupportEmail
                ? ['support_mail' => ['id' => $job->data->id, 'expires_at' => $job->data->expiresAt]]
                : [];
        });
        $warmupDispatcher->dispatchIfAppropriate();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    protected function configureUrlScheme(): void
    {
        if ($this->app->environment(['staging', 'production'])) {
            URL::forceScheme('https');
        }
    }
}
