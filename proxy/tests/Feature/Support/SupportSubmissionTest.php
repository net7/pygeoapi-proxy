<?php

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->from('/login');
    config(['queue.default' => 'database', 'support.allow_guests' => true]);
    Queue::fake();
    Mail::fake();
    Storage::fake('local');
});

test('a final submission uses the editable email without modifying the account', function () {
    $contact = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($contact->id);
    $user = User::factory()->create();
    $original = $user->email;
    $this->actingAs($user)->from('/settings/profile')->post('/support', [
        'subject' => '  Need help  ', 'description' => "  First line\nSecond line  ",
        'email' => '  DIFFERENT@example.org  ',
        'attachments' => [UploadedFile::fake()->createWithContent('trace.log', 'diagnostics')],
        'account' => ['id' => 999, 'email' => 'spoof@example.org'],
        'recipient' => 'spoof@example.org',
    ])->assertRedirect('/settings/profile')->assertSessionHasNoErrors();
    Queue::assertPushed(SendSupportEmail::class, function (SendSupportEmail $job) use ($user, $original): bool {
        return $job->data->replyTo === 'different@example.org'
            && $job->data->subject === 'Need help'
            && $job->data->description === "First line\nSecond line"
            && $job->data->account === ['id' => $user->id, 'name' => $user->name, 'email' => $original]
            && count($job->data->attachments) === 1;
    });
    expect($user->fresh()->email)->toBe($original);
    Mail::assertNothingSent();
});

test('guest submission contains no invented account identity', function () {
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    $this->post('/support', ['subject' => 'Help', 'description' => 'Details', 'email' => 'guest@example.org'])
        ->assertRedirect('/login')->assertSessionHasNoErrors();
    Queue::assertPushed(SendSupportEmail::class, fn ($job): bool => $job->data->account === null);
});

test('support unavailable returns a form error without side effects', function () {
    $this->postJson('/support', ['subject' => 'Help', 'description' => 'Details', 'email' => 'guest@example.org'])
        ->assertUnprocessable()->assertJsonValidationErrors('support');
    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});

test('precognition validates text and ignores files without any side effects', function (bool $valid) {
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    $response = $this->withHeaders([
        'Precognition' => 'true', 'Precognition-Validate-Only' => 'email',
    ])->postJson('/support', [
        'email' => $valid ? 'valid@example.org' : 'invalid',
        'attachments' => [UploadedFile::fake()->createWithContent('bad.exe', 'binary')],
    ]);
    $valid ? $response->assertNoContent() : $response->assertUnprocessable()->assertJsonValidationErrors('email');
    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
})->with([true, false]);
