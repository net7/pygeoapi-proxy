<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\HandleLanguage;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');

        $middleware->redirectUsersTo(fn (Request $request): string => route('jobs.index', absolute: false));

        $middleware->encryptCookies(except: ['appearance', 'language', 'sidebar_state']);

        $middleware->web(append: [
            HandleLanguage::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request): Response {
            $status = $response->getStatusCode();

            if (
                ! in_array($status, [403, 404], true)
                || $request->is('api/*')
                || $request->routeIs('*.download', '*.preview', '*.map-tile')
                || (! $request->header('X-Inertia') && ($request->expectsJson() || $request->ajax()))
            ) {
                return $response;
            }

            return Inertia::render($status === 403 ? 'errors/forbidden' : 'errors/not-found', [
                'authenticated' => $request->user() !== null,
            ])->toResponse($request)->setStatusCode($status);
        });
    })->create();
