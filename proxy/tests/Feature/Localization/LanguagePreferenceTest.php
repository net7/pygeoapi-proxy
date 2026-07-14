<?php

use App\Models\User;
use Illuminate\Support\Facades\File;

test('language defaults to italian', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('valid language cookie sets html language', function () {
    $this->withUnencryptedCookie('language', 'en')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="en"', false);
});

test('invalid language cookie falls back to italian', function () {
    $this->withUnencryptedCookie('language', 'fr')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('inertia shares the current language', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withUnencryptedCookie('language', 'en')
        ->get(route('jobs.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('language', 'en'));
});

test('server side toast strings follow the current language', function () {
    app()->setLocale('it');

    expect(__('Process started'))->toBe('Processo avviato')
        ->and(__('The process is running.'))->toBe('Il processo è in esecuzione.')
        ->and(__('Users deactivated'))->toBe('Utenti disattivati');

    app()->setLocale('en');

    expect(__('Process started'))->toBe('Process started')
        ->and(__('The process is running.'))->toBe('The process is running.');
});

test('custom server side user messages have italian translations', function () {
    $translations = json_decode(File::get(lang_path('it.json')), true, flags: JSON_THROW_ON_ERROR);
    $strings = collect(File::allFiles(app_path()))
        ->flatMap(function ($file): array {
            preg_match_all('/__\(\s*[\'"]([^\'"]+)[\'"]/', File::get($file->getPathname()), $matches);

            return $matches[1];
        })
        ->unique()
        ->sort()
        ->values();

    $missing = $strings
        ->reject(fn (string $string): bool => array_key_exists($string, $translations))
        ->values();

    expect($missing->all())->toBe([]);
});
