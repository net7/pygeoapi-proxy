<?php

namespace App\Providers;

use App\Jobs\SendSupportEmail;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Queue\Queue;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
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
        RateLimiter::for('support', function (Request $request): Limit {
            $identity = $request->user() !== null
                ? 'user:'.$request->user()->getAuthIdentifier() : 'ip:'.$request->ip();
            $limit = $request->isAttemptingPrecognition()
                ? Limit::perMinute(60)->by('support-validation:'.$identity)
                : Limit::perHour(5)->by('support-submit:'.$identity);

            return $limit->response(function (Request $request, array $headers) {
                $message = __('Too many support requests. Please try again later.');
                if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                    return response()->json(['message' => $message, 'errors' => ['support' => [$message]]], 429, $headers);
                }

                return back()->withErrors(['support' => $message])->withHeaders($headers);
            });
        });
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
