<?php

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->from('/login');
    config(['support.allow_guests' => true, 'queue.default' => 'database']);
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    Queue::fake();
    Storage::fake('local');
});

test('support rejects invalid text fields', function (string $field, mixed $value) {
    $payload = ['subject' => 'Help', 'description' => 'Details', 'email' => 'guest@example.org'];
    $payload[$field] = $value;
    $this->postJson('/support', $payload)->assertUnprocessable()->assertJsonValidationErrors($field);
    Queue::assertNothingPushed();
})->with([
    ['subject', ''], ['subject', '  '], ['subject', []], ['subject', str_repeat('a', 201)],
    ['subject', "Line\nBreak"], ['subject', "\rHelp"], ['subject', "Help\n"],
    ['description', ''], ['description', '  '], ['description', []], ['description', str_repeat('a', 10001)],
    ['email', ''], ['email', []], ['email', 'invalid'], ['email', str_repeat('a', 250).'@example.org'],
]);

test('text field upper boundaries and an existing account email are accepted', function () {
    $user = User::factory()->create();
    $this->postJson('/support', [
        'subject' => str_repeat('à', 200), 'description' => str_repeat('a', 10000),
        'email' => strtoupper($user->email),
    ])->assertRedirect('/login');
    Queue::assertPushed(SendSupportEmail::class, fn ($job): bool => $job->data->replyTo === $user->email);
});

test('three files at exactly five mib are accepted and one byte over is rejected', function () {
    $payload = ['subject' => 'Help', 'description' => 'Details', 'email' => 'guest@example.org'];
    $files = array_map(fn ($i) => UploadedFile::fake()->createWithContent("trace{$i}.log", str_repeat('a', 5242880)), range(1, 3));
    $this->post('/support', [...$payload, 'attachments' => $files])->assertSessionHasNoErrors()->assertRedirect('/login');
    $this->postJson('/support', [...$payload, 'attachments' => [
        UploadedFile::fake()->createWithContent('trace.log', str_repeat('a', 5242881)),
    ]])->assertUnprocessable()->assertJsonValidationErrors('attachments.0');
    Queue::assertPushed(SendSupportEmail::class, 1);
});

test('attachment structure and uploads are validated', function (string $scenario) {
    $files = match ($scenario) {
        'scalar' => 'file.txt',
        'four' => array_map(fn () => UploadedFile::fake()->createWithContent('trace.log', 'text'), range(1, 4)),
        'invalid' => [new UploadedFile(__FILE__, 'trace.log', null, UPLOAD_ERR_PARTIAL, true)],
    };
    $this->postJson('/support', [
        'subject' => 'Help', 'description' => 'Details', 'email' => 'guest@example.org', 'attachments' => $files,
    ])->assertUnprocessable()->assertJsonValidationErrors($scenario === 'invalid' ? 'attachments.0' : 'attachments');
    Queue::assertNothingPushed();
})->with(['scalar', 'four', 'invalid']);

test('attachment extension and detected content must agree', function (string $name, string $content, bool $valid) {
    $fixture = match ($content) {
        'png', 'jpg', 'jpeg', 'webp' => UploadedFile::fake()->image($name),
        default => UploadedFile::fake()->createWithContent($name, $content),
    };
    // Testing\\File overrides MIME detection using the name; exercise real server detection.
    $file = new UploadedFile($fixture->getPathname(), $name, 'application/octet-stream', null, true);
    $response = $this->postJson('/support', [
        'subject' => 'Help', 'description' => 'Details', 'email' => 'guest@example.org', 'attachments' => [$file],
    ]);
    if ($valid) {
        $response->assertRedirect('/login');
        Queue::assertPushed(SendSupportEmail::class, 1);
    } else {
        $response->assertUnprocessable()->assertJsonValidationErrors('attachments.0');
        Queue::assertNothingPushed();
    }
})->with([
    ['image.png', 'png', true], ['image.jpg', 'jpg', true], ['image.jpeg', 'jpeg', true], ['image.webp', 'webp', true],
    ['manual.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", true],
    ['note.txt', 'plain text', true], ['trace.LOG', 'unexpected end at line 4', true],
    ['table.csv', "a,b\nmissing delimiter", true], ['broken.json', '{broken JSON', true],
    ['empty.txt', '', true], ['archive.zip', "PK\x03\x04".str_repeat("\0", 100), false],
    ['fake.png', 'plain text', false], ['fake.pdf', 'plain text', false],
    ['binary.log', "\x7fELF".str_repeat("\0", 200), false], ['executable.txt', 'MZ'.str_repeat("\0", 200), false],
]);
