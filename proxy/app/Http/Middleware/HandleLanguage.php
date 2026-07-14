<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class HandleLanguage
{
    private const DefaultLanguage = 'it';

    /**
     * @var list<string>
     */
    private const SupportedLanguages = ['it', 'en'];

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $language = $this->languageFromRequest($request);

        app()->setLocale($language);
        View::share('language', $language);

        return $next($request);
    }

    private function languageFromRequest(Request $request): string
    {
        $language = $request->cookie('language', self::DefaultLanguage);

        if (! is_string($language)) {
            return self::DefaultLanguage;
        }

        return in_array($language, self::SupportedLanguages, true)
            ? $language
            : self::DefaultLanguage;
    }
}
