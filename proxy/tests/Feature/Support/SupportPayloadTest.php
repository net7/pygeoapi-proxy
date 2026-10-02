<?php

use App\Jobs\SendSupportEmail;
use App\Support\SupportPayload;

test('support metadata is extracted without decrypting the job', function () {
    $metadata = ['id' => '9c6f24b6-0d25-40ad-ac47-7d25eec60949', 'expires_at' => 1900000000];
    $payload = json_encode(['data' => ['commandName' => SendSupportEmail::class, 'command' => 'ciphertext'], 'support_mail' => $metadata]);
    expect(SupportPayload::metadata($payload))->toBe($metadata);
});

test('malformed or unrelated payloads never authorize cleanup', function (string $payload) {
    expect(SupportPayload::metadata($payload))->toBeNull();
})->with(['invalid JSON', 'null', '[]', '"text"', '{"data":"text"}', '{"support_mail":"text"}']);

test('invalid support markers are rejected', function (string $class, mixed $id, mixed $expiresAt) {
    $payload = json_encode([
        'data' => ['commandName' => $class],
        'support_mail' => ['id' => $id, 'expires_at' => $expiresAt],
    ]);
    expect(SupportPayload::metadata($payload))->toBeNull();
})->with([
    ['OtherJob', '9c6f24b6-0d25-40ad-ac47-7d25eec60949', 1900000000],
    [SendSupportEmail::class, '../escape', 1900000000],
    [SendSupportEmail::class, null, 1900000000],
    [SendSupportEmail::class, '9c6f24b6-0d25-40ad-ac47-7d25eec60949', '1900000000'],
    [SendSupportEmail::class, '9c6f24b6-0d25-40ad-ac47-7d25eec60949', 0],
    [SendSupportEmail::class, '9c6f24b6-0d25-40ad-ac47-7d25eec60949', -1],
]);
