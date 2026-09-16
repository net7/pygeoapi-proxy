<?php

use App\Models\User;
use App\Support\AuthFeatures;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;

test('language defaults to english', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertSee('lang="en"', false);
});

test('valid language cookie sets html language', function () {
    $this->withUnencryptedCookie('language', 'it')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="it"', false);
});

test('invalid language cookie falls back to english', function () {
    $this->withUnencryptedCookie('language', 'fr')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('lang="en"', false);
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

test('invalid sign in uses the selected language', function () {
    config(['fortify.features' => [AuthFeatures::passwordLogin()]]);

    $this->withUnencryptedCookie('language', 'it')
        ->post(route('login.store'), [
            'email' => 'missing@example.test',
            'password' => 'incorrect-password',
        ])
        ->assertSessionHasErrors(['email' => 'Le credenziali non corrispondono ai nostri dati.']);
});

test('italian authentication catalogs cover framework messages and placeholders', function (string $catalog) {
    $frameworkMessages = require base_path("vendor/laravel/framework/src/Illuminate/Translation/lang/en/{$catalog}.php");

    app()->setLocale('it');

    foreach ($frameworkMessages as $key => $message) {
        $translated = trans("{$catalog}.{$key}");

        expect($translated)->not->toBe($message)->not->toBe("{$catalog}.{$key}");
        preg_match_all('/:[A-Za-z_]+/', $message, $placeholders);

        foreach ($placeholders[0] as $placeholder) {
            expect($translated)->toContain($placeholder);
        }
    }
})->with(['auth', 'passwords']);

test('italian validation errors use readable field names', function () {
    app()->setLocale('it');

    $errors = Validator::make([], [
        'name' => ['required'],
        'current_password' => ['required'],
        'email_confirmation' => ['required'],
    ])->errors();

    expect($errors->first('name'))->toContain('nome')
        ->and($errors->first('current_password'))->toContain('password attuale')
        ->and($errors->first('email_confirmation'))->toContain('conferma email');
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

test('italian validation messages cover the installed Laravel catalog', function () {
    $frameworkMessages = require base_path('vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php');
    $italianMessages = require lang_path('it/validation.php');

    unset(
        $frameworkMessages['custom'],
        $frameworkMessages['attributes'],
        $italianMessages['custom'],
        $italianMessages['attributes'],
    );

    $frameworkMessages = Arr::dot($frameworkMessages);
    $italianMessages = Arr::dot($italianMessages);

    expect(array_keys($italianMessages))->toBe(array_keys($frameworkMessages));

    $placeholders = function (string $message): array {
        preg_match_all('/:[A-Za-z_]+/', $message, $matches);

        $placeholders = array_values(array_unique(array_map(strtolower(...), $matches[0])));
        sort($placeholders);

        return $placeholders;
    };

    foreach ($frameworkMessages as $key => $frameworkMessage) {
        expect($italianMessages[$key])->not->toBe($frameworkMessage)
            ->and($placeholders($italianMessages[$key]))->toBe($placeholders($frameworkMessage));
    }
});
