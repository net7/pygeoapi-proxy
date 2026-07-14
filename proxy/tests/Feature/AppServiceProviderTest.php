<?php

use App\Providers\AppServiceProvider;
use App\Services\Ogc\OgcProcessCacheWarmupDispatcher;
use Illuminate\Support\Facades\URL;

afterEach(function () {
    $this->app['env'] = 'testing';
    URL::forceScheme(null);
});

it('forces generated URLs to use HTTPS in secure deployment environments', function (string $environment) {
    $this->app['env'] = $environment;
    URL::forceScheme(null);

    $provider = new class($this->app) extends AppServiceProvider
    {
        protected function configureDefaults(): void
        {
            // Isolate URL configuration from unrelated application defaults.
        }
    };

    $provider->boot(new OgcProcessCacheWarmupDispatcher);

    expect(URL::to('/'))->toStartWith('https://');
})->with(['staging', 'production']);

it('does not force generated URLs to use HTTPS in other environments', function () {
    $this->app['env'] = 'testing';
    URL::forceScheme(null);

    $provider = new class($this->app) extends AppServiceProvider
    {
        protected function configureDefaults(): void
        {
            // Isolate URL configuration from unrelated application defaults.
        }
    };

    $provider->boot(new OgcProcessCacheWarmupDispatcher);

    expect(URL::to('/'))->toStartWith('http://');
});
