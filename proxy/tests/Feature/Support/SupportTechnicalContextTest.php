<?php

use App\Jobs\SendSupportEmail;
use App\Mail\SupportEmail;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->from('/login');
    config(['support.allow_guests' => true, 'queue.default' => 'database']);
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    Queue::fake();
    Storage::fake('local');
});

test('a final request includes only the declared technical context in both email formats', function () {
    $agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';

    $this->withHeaders(['User-Agent' => $agent, 'Referer' => 'https://example.org/private?token=secret'])
        ->post('/support', [
            'subject' => 'A rendering problem', 'description' => "First line\n    indented log line",
            'email' => 'reply@example.org',
            'technical_context' => ['language' => 'it-IT', 'timezone' => 'Europe/Rome', 'viewport_width' => '1440', 'viewport_height' => '900'],
        ])->assertRedirect()->assertSessionHasNoErrors();

    Queue::assertPushed(SendSupportEmail::class, function (SendSupportEmail $job) use ($agent): bool {
        expect($job->data->technicalContext ?? null)->toBe([
            'browser' => 'Microsoft Edge 140.0.0.0', 'operating_system' => 'Windows',
            'language' => 'it-IT', 'timezone' => 'Europe/Rome', 'viewport' => '1440 × 900 px', 'user_agent' => $agent,
        ]);
        $mail = new SupportEmail($job->data);
        foreach (['Microsoft Edge 140.0.0.0', 'Windows', 'it-IT', 'Europe/Rome', '1440 × 900 px', 'indented log line'] as $value) {
            $mail->assertSeeInHtml($value);
            $mail->assertSeeInText($value);
        }
        expect($mail->render())->not->toContain('token=secret', '127.0.0.1');

        return true;
    });
});

test('the email reports browser and operating system as declared by common user agents', function (string $agent, string $browser, string $system) {
    $this->withHeader('User-Agent', $agent)->post('/support', [
        'subject' => 'Browser issue', 'description' => 'The page does not render correctly.', 'email' => 'reply@example.org',
    ])->assertSessionHasNoErrors();

    Queue::assertPushed(SendSupportEmail::class, fn (SendSupportEmail $job): bool => ($job->data->technicalContext['browser'] ?? null) === $browser
        && ($job->data->technicalContext['operating_system'] ?? null) === $system
    );
})->with([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 'Safari 18.0', 'macOS'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox 140.0', 'Linux'],
    ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36', 'Chrome 140.0.0.0', 'Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.0.0 Mobile/15E148 Safari/604.1', 'Chrome 140.0.0.0', 'iOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 OPR/122.0.0.0', 'Opera 122.0.0.0', 'Windows'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', 'Samsung Internet 28.0', 'Android'],
    ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', 'Chrome 140.0.0.0', 'Chrome OS'],
]);

test('support remains usable when optional technical context is unavailable', function () {
    $this->withHeader('User-Agent', '')->post('/support', [
        'subject' => 'Help', 'description' => 'A problem without client details.', 'email' => 'reply@example.org',
    ])->assertSessionHasNoErrors();

    Queue::assertPushed(SendSupportEmail::class, function (SendSupportEmail $job): bool {
        expect($job->data->technicalContext ?? null)->toBe([]);
        (new SupportEmail($job->data))->assertSeeInText('Technical details were not available.');

        return true;
    });
});

test('untrusted metadata is bounded and escaped in the html email', function () {
    $agent = '<script>alert("client")</script>'.str_repeat('x', 1200);
    $this->withHeader('User-Agent', $agent)->post('/support', [
        'subject' => '<img src=x onerror=alert(1)>', 'description' => 'A problem with unsafe metadata.', 'email' => 'reply@example.org',
        'technical_context' => ['language' => '<script>bad</script>', 'timezone' => 'UTC'],
    ])->assertSessionHasNoErrors();

    Queue::assertPushed(SendSupportEmail::class, function (SendSupportEmail $job): bool {
        expect(mb_strlen($job->data->technicalContext['user_agent'] ?? ''))->toBe(1024);
        expect((new SupportEmail($job->data))->render())
            ->toContain('&lt;script&gt;', '&lt;img')
            ->not->toContain('<script>', '<img src=x');

        return true;
    });
});

test('unexpected or malformed technical context cannot enter the queued payload', function (mixed $context, string $field) {
    $this->postJson('/support', [
        'subject' => 'Help', 'description' => 'A problem with client details.', 'email' => 'reply@example.org',
        'technical_context' => $context,
    ])->assertUnprocessable()->assertJsonValidationErrors($field);

    Queue::assertNothingPushed();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
})->with([
    ['invalid', 'technical_context'],
    [['cookies' => 'session=secret'], 'technical_context'],
    [['language' => ['it']], 'technical_context.language'],
    [['language' => str_repeat('x', 65)], 'technical_context.language'],
    [['timezone' => str_repeat('x', 101)], 'technical_context.timezone'],
    [['viewport_width' => 'wide'], 'technical_context.viewport_width'],
    [['viewport_height' => 0], 'technical_context.viewport_height'],
    [['viewport_width' => 100001], 'technical_context.viewport_width'],
]);

test('precognition ignores technical context without creating a support job', function () {
    $this->withHeaders(['Precognition' => 'true', 'Precognition-Validate-Only' => 'email'])
        ->postJson('/support', ['email' => 'reply@example.org', 'technical_context' => ['cookies' => 'ignored']])
        ->assertNoContent();

    Queue::assertNothingPushed();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});
