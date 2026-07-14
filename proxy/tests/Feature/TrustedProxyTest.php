<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

it('trusts HTTPS headers from the reverse proxy', function () {
    Route::get('/_test/trusted-proxy', fn (Request $request) => response()->json([
        'scheme' => $request->getScheme(),
        'secure' => $request->isSecure(),
        'asset_url' => asset('build/assets/app.css'),
    ]));

    $this->withServerVariables([
        'REMOTE_ADDR' => '172.18.0.1',
        'SERVER_PORT' => 80,
        'HTTPS' => 'off',
    ])->withHeaders([
        'Host' => 'proxygeoapi.netseven.work',
        'X-Forwarded-For' => '203.0.113.10',
        'X-Forwarded-Host' => 'proxygeoapi.netseven.work',
        'X-Forwarded-Port' => '443',
        'X-Forwarded-Proto' => 'https',
    ])->get('/_test/trusted-proxy')
        ->assertOk()
        ->assertExactJson([
            'scheme' => 'https',
            'secure' => true,
            'asset_url' => 'https://proxygeoapi.netseven.work/build/assets/app.css',
        ]);
});
