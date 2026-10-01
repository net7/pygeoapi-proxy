<?php

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['support.allow_guests' => true, 'queue.default' => 'database']);
    Cache::flush();
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    Queue::fake();
    Storage::fake('local');
});

test('invalid final attempts consume the five per hour quota', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/support')->assertUnprocessable();
    }
    $this->postJson('/support')->assertTooManyRequests()->assertJsonValidationErrors('support')->assertHeader('Retry-After');
    Queue::assertNothingPushed();
});

test('precognition has its own sixty per minute quota', function () {
    for ($i = 0; $i < 60; $i++) {
        $this->withHeaders(['Precognition' => 'true', 'Precognition-Validate-Only' => 'email'])
            ->postJson('/support', ['email' => 'valid@example.org'])->assertNoContent();
    }
    $this->postJson('/support', ['email' => 'valid@example.org'])->assertTooManyRequests();
    $this->flushHeaders();
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/support', ['subject' => 'Help', 'description' => 'Details', 'email' => 'valid@example.org'])
            ->assertRedirect('/support');
    }
    $this->postJson('/support')->assertTooManyRequests();
    Queue::assertPushed(SendSupportEmail::class, 5);
});

test('manual precognition headers cannot bypass submission quotas', function (array $headers, bool $precognitive) {
    $this->withHeaders($headers);
    for ($i = 0; $i < 6; $i++) {
        $response = $this->postJson('/support', ['subject' => 'Help', 'description' => 'Details', 'email' => 'valid@example.org']);
        if ($precognitive) {
            $response->assertNoContent();
        } elseif ($i < 5) {
            $response->assertRedirect('/support');
        } else {
            $response->assertTooManyRequests();
        }
    }
    Queue::assertPushed(SendSupportEmail::class, $precognitive ? 0 : 5);
})->with([
    [['Precognition' => 'true'], true],
    [['Precognition' => 'false'], false],
    [['Precognition' => '1'], false],
    [[], false],
    [['Precognition-Validate-Only' => 'email'], false],
]);

test('accounts and guest ips have independent quotas', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $this->actingAs($first);
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/support')->assertUnprocessable();
    }
    $this->postJson('/support')->assertTooManyRequests();
    $this->actingAs($second)->postJson('/support')->assertUnprocessable();
    auth()->forgetGuards();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.1']);
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/support')->assertUnprocessable();
    }
    $this->postJson('/support')->assertTooManyRequests();
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->postJson('/support')->assertUnprocessable();
});

test('inertia throttling returns a form error rather than a success response', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/support');
    }
    $this->flushHeaders();
    $this->from('/support')->withHeaders(['X-Inertia' => 'true'])
        ->post('/support')->assertRedirect('/support')->assertSessionHasErrors('support')->assertHeader('Retry-After');
});
