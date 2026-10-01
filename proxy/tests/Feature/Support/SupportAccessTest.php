<?php

use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('guest access is enforced on get post and precognition', function ($flag, bool $allowed) {
    config(['support.allow_guests' => $flag]);
    Queue::fake();
    Mail::fake();
    Storage::fake('local');
    $get = $this->get('/support');
    $post = $this->post('/support', []);
    $precognition = $this->withHeaders(['Precognition' => 'true'])->post('/support', []);
    if ($allowed) {
        $get->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('support/create', false)->where('initialEmail', '')->where('available', false));
        $post->assertSessionHasErrors();
        $precognition->assertSessionHasErrors();
    } else {
        $get->assertRedirect(route('login'));
        $post->assertRedirect(route('login'));
        $precognition->assertRedirect(route('login'));
    }
    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
})->with([[false, false], [null, false], ['invalid', false], [true, true]]);

test('support guest env flag is fail closed', function (?string $value, bool $expected) {
    $environment = Env::getRepository();
    $previous = $environment->get('SUPPORT_ALLOW_GUESTS');
    try {
        $value === null ? $environment->clear('SUPPORT_ALLOW_GUESTS') : $environment->set('SUPPORT_ALLOW_GUESTS', $value);
        $configuration = require config_path('support.php');
        expect($configuration['allow_guests'])->toBe($expected);
    } finally {
        $previous === null ? $environment->clear('SUPPORT_ALLOW_GUESTS') : $environment->set('SUPPORT_ALLOW_GUESTS', $previous);
    }
})->with([[null, false], ['false', false], ['true', true], ['invalid', false]]);

test('an active account sees its email and no technical contact address', function (string $role) {
    config(['support.allow_guests' => false]);
    $contact = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($contact->id);
    $user = User::factory()->create(['role' => $role]);
    $this->actingAs($user)->get('/support')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('support/create', false)->where('available', true)->where('initialEmail', $user->email)
        ->where('support.allowGuests', false)->where('support.maxAttachments', 3)
        ->where('support.maxFileBytes', 5242880)->missing('technicalContact'));
})->with(['user', 'admin']);

test('a deactivated session is rejected even when guest support is enabled', function (string $method) {
    config(['support.allow_guests' => true]);
    $this->actingAs(User::factory()->create(['deactivated_at' => now()]));
    if ($method === 'precognition') {
        $this->withHeaders(['Precognition' => 'true'])->post('/support')->assertRedirect(route('account.deactivated'));
    } else {
        $this->{$method}('/support')->assertRedirect(route('account.deactivated'));
    }
    $this->assertGuest();
})->with(['get', 'post', 'precognition']);

test('json guest submissions receive an authentication error when disabled', function () {
    config(['support.allow_guests' => false]);
    $this->postJson('/support')->assertUnauthorized();
});
