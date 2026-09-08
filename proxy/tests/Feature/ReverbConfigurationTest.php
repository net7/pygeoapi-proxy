<?php

test('pages expose the public websocket connection without server credentials', function (string $host) {
    config([
        'broadcasting.client' => [
            'key' => 'public-websocket-key',
            'host' => $host,
            'port' => 443,
            'scheme' => 'https',
        ],
        'broadcasting.connections.reverb.secret' => 'private-broadcast-secret',
        'broadcasting.connections.reverb.options.host' => 'reverb-internal',
    ]);

    $response = $this->get(route('login'));

    $response->assertSee('name="reverb-config"', escape: false)
        ->assertDontSee('private-broadcast-secret')
        ->assertDontSee('reverb-internal');

    $document = new DOMDocument;
    $document->loadHTML($response->getContent(), LIBXML_NOERROR | LIBXML_NOWARNING);
    $element = (new DOMXPath($document))->query('//meta[@name="reverb-config"]')->item(0);

    expect(json_decode($element->getAttribute('content'), true, flags: JSON_THROW_ON_ERROR))->toBe([
        'key' => 'public-websocket-key',
        'host' => $host,
        'port' => 443,
        'scheme' => 'https',
    ]);
})->with(['public_app.example.test', 'renamed-ui.example.test']);

test('pages preserve the build configuration when no runtime websocket host is set', function () {
    config(['broadcasting.client.host' => null]);

    $response = $this->get(route('login'));

    $response->assertOk()->assertDontSee('name="reverb-config"', escape: false);
});

test('runtime websocket configuration cannot inject page markup', function () {
    config([
        'broadcasting.client' => [
            'key' => '\"><script>alert("injected")</script>',
            'host' => 'public-app.example.test',
            'port' => 443,
            'scheme' => 'https',
        ],
    ]);

    $response = $this->get(route('login'));

    $response->assertSee('name="reverb-config"', escape: false)
        ->assertDontSee('<script>alert("injected")</script>', escape: false);

    $document = new DOMDocument;
    $document->loadHTML($response->getContent(), LIBXML_NOERROR | LIBXML_NOWARNING);
    $element = (new DOMXPath($document))->query('//meta[@name="reverb-config"]')->item(0);

    expect(json_decode($element->getAttribute('content'), true, flags: JSON_THROW_ON_ERROR)['key'])
        ->toBe('\"><script>alert("injected")</script>');
});

test('runtime environment keeps public and internal websocket connections separate', function () {
    $originalEnvironment = $_ENV;
    $originalServer = $_SERVER;
    $runtimeEnvironment = [
        'REVERB_APP_KEY' => 'runtime-public-key',
        'REVERB_HOST' => 'reverb-internal',
        'REVERB_PORT' => '8000',
        'REVERB_SCHEME' => 'http',
        'REVERB_PUBLIC_HOST' => 'renamed-ui.example.test',
        'REVERB_PUBLIC_PORT' => '443',
        'REVERB_PUBLIC_SCHEME' => 'https',
        'REVERB_ALLOWED_ORIGINS' => ' renamed-ui.example.test, second-ui.example.test, ',
    ];
    $_ENV = array_replace($_ENV, $runtimeEnvironment);
    $_SERVER = array_replace($_SERVER, $runtimeEnvironment);

    try {
        $broadcasting = require config_path('broadcasting.php');
        $reverb = require config_path('reverb.php');

        expect($broadcasting['client'])->toBe([
            'key' => 'runtime-public-key',
            'host' => 'renamed-ui.example.test',
            'port' => 443,
            'scheme' => 'https',
        ]);
        expect($broadcasting['connections']['reverb']['options']['host'])->toBe('reverb-internal');
        expect($reverb['apps']['apps'][0]['allowed_origins'])->toBe([
            'renamed-ui.example.test',
            'second-ui.example.test',
        ]);
    } finally {
        $_ENV = $originalEnvironment;
        $_SERVER = $originalServer;
    }
});
