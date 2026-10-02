<?php

use App\Support\SmtpDiagnostics;

test('smtp diagnostics redact authentication payloads while retaining server replies', function (string $conversation) {
    $diagnostics = new SmtpDiagnostics([]);

    expect($diagnostics->redact($conversation))
        ->toContain('AUTH', '[REDACTED]', '235 2.7.0 Authenticated', '> MAIL FROM:<sender@example.com>')
        ->not->toContain('secret-payload', 'another-payload');
})->with([
    'login' => "> AUTH LOGIN\r\n< 334 Username\r\n> secret-payload\r\n< 334 Password\r\n> another-payload\r\n< 235 2.7.0 Authenticated\r\n> MAIL FROM:<sender@example.com>\r\n",
    'plain' => "[2026-10-02T10:51:56.123456+00:00] > AUTH PLAIN secret-payload\n[2026-10-02T10:51:56.123456+00:00] < 235 2.7.0 Authenticated\n> MAIL FROM:<sender@example.com>\n",
    'oauth' => "> AUTH XOAUTH2 secret-payload\n< 235 2.7.0 Authenticated\n> MAIL FROM:<sender@example.com>\n",
    'challenge response' => "> AUTH CRAM-MD5\n< 334 challenge\n> secret-payload\n< 235 2.7.0 Authenticated\n> MAIL FROM:<sender@example.com>\n",
]);

test('smtp diagnostics use URL overrides and never expose URL credentials or unknown options', function () {
    $diagnostics = new SmtpDiagnostics([
        'transport' => 'smtp',
        'host' => 'ignored.example.test',
        'port' => 25,
        'username' => 'old-user',
        'password' => 'old-password',
        'url' => 'smtp://url-user:p%40ss%3Aword@smtp.example.test:587?timeout=12&password=query-secret&token=hidden',
    ]);

    $configuration = $diagnostics->configuration();

    expect($configuration)->toMatchArray([
        'host' => 'smtp.example.test',
        'port' => 587,
        'timeout' => 12,
        'authentication' => 'configured',
    ]);
    expect(json_encode($configuration))->not->toContain('password', 'url-user', 'token', 'hidden', 'old-user');
    expect($diagnostics->redact('old-user old-password url-user p@ss:word p%40ss%3Aword query-secret cXVlcnktc2VjcmV0'))
        ->toBe('[REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED] [REDACTED]');
});

test('smtp diagnostics preserve exception causes without serializing secret arguments', function () {
    $diagnostics = new SmtpDiagnostics(['password' => 'smtp-secret']);
    $cause = new RuntimeException('Authentication failed: smtp-secret', 535);
    $exception = new RuntimeException('Could not send: smtp-secret', 0, $cause);

    $exceptions = $diagnostics->exceptions($exception);

    expect($exceptions)->toHaveCount(2);
    expect($exceptions[1])->toMatchArray(['type' => RuntimeException::class, 'code' => 535, 'message' => 'Authentication failed: [REDACTED]']);
    expect($exceptions[0]['trace'])->not->toBeEmpty();
    expect(json_encode($exceptions))->not->toContain('smtp-secret', '"args"', '"object"');
});

test('smtp diagnostics also redact authentication payloads echoed by the server or exceptions', function () {
    $diagnostics = new SmtpDiagnostics([]);
    $debug = "> AUTH PLAIN AHVzZXIAcGFzc3dvcmQ=\n< 535 Rejected AHVzZXIAcGFzc3dvcmQ=\n> AUTH LOGIN\n< 334 Password\n> c2VjcmV0\n< 535 Rejected c2VjcmV0\n";

    expect($diagnostics->redact($debug))
        ->toContain('< 535 Rejected [REDACTED]')
        ->not->toContain('AHVzZXIAcGFzc3dvcmQ=', 'c2VjcmV0');
    expect($diagnostics->redact('Authentication failed: AHVzZXIAcGFzc3dvcmQ= / c2VjcmV0'))
        ->toBe('Authentication failed: [REDACTED] / [REDACTED]');
});

test('smtp diagnostics identify automatic ports instead of reporting an incorrect default', function (?int $port) {
    $diagnostics = new SmtpDiagnostics(['transport' => 'smtp', 'host' => 'smtp.example.test', 'port' => $port]);

    expect($diagnostics->configuration()['port'])->toBe('automatic');
})->with([null, 0]);

test('smtp diagnostics expose the unresolved transport caused by an empty mail URL', function () {
    $diagnostics = new SmtpDiagnostics(['transport' => 'smtp', 'url' => '']);

    expect($diagnostics->configuration()['transport'])->toBe('not configured');
});
