<?php

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('guest access controls shared availability post and precognition', function ($flag, bool $allowed) {
    config(['support.allow_guests' => $flag]);
    Queue::fake();
    Mail::fake();
    Storage::fake('local');
    $get = $this->get('/login');
    $post = $this->post('/support', []);
    $precognition = $this->withHeaders(['Precognition' => 'true'])->post('/support', []);
    $get->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('support.allowGuests', $allowed)->where('support.available', false)
        ->where('support.isTechnicalContact', false)->where('auth.user', null)
        ->where('supportContactEmail', null));
    if ($allowed) {
        $post->assertSessionHasErrors();
        $precognition->assertSessionHasErrors();
    } else {
        $post->assertRedirect(route('login'));
        $precognition->assertRedirect(route('login'));
    }
    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
})->with([[false, false], [null, false], ['invalid', false], [true, true]]);

test('login offers the technical contact email only when guest support is disabled', function (bool $allowGuests) {
    config(['support.allow_guests' => $allowGuests]);
    $contact = User::factory()->admin()->create(['email' => 'technical@example.org']);
    app(SupportContactManager::class)->assign($contact->id);

    $this->get('/login')->assertInertia(fn (Assert $page) => $page
        ->component('auth/login')
        ->where('supportContactEmail', $allowGuests ? null : 'technical@example.org')
        ->where('support.allowGuests', $allowGuests)
        ->where('support.available', $allowGuests));
})->with([false, true]);

test('login uses the newly assigned technical contact email', function () {
    config(['support.allow_guests' => false]);
    $contacts = app(SupportContactManager::class);
    $contacts->assign(User::factory()->admin()->create(['email' => 'previous@example.org'])->id);
    $this->get('/login')->assertInertia(fn (Assert $page) => $page
        ->where('supportContactEmail', 'previous@example.org'));
    $contacts->assign(User::factory()->admin()->create(['email' => 'current@example.org'])->id);

    $this->get('/login')->assertInertia(fn (Assert $page) => $page
        ->where('supportContactEmail', 'current@example.org'));
});

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
    $this->actingAs($user)->get('/settings/profile')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('support.available', true)->where('auth.user.email', $user->email)
        ->where('support.isTechnicalContact', false)
        ->where('support.allowGuests', false)->where('support.maxAttachments', 3)
        ->where('support.maxFileBytes', 5242880)->missing('technicalContact')
        ->missing('supportContactEmail'));
})->with(['user', 'admin']);

test('a deactivated session is rejected even when guest support is enabled', function (string $method) {
    config(['support.allow_guests' => true]);
    $this->actingAs(User::factory()->create(['deactivated_at' => now()]));
    if ($method === 'precognition') {
        $this->withHeaders(['Precognition' => 'true'])->post('/support')->assertRedirect(route('account.deactivated'));
    } else {
        $this->{$method}($method === 'get' ? '/settings/profile' : '/support')->assertRedirect(route('account.deactivated'));
    }
    $this->assertGuest();
})->with(['get', 'post', 'precognition']);

test('json guest submissions receive an authentication error when disabled', function () {
    config(['support.allow_guests' => false]);
    $this->postJson('/support')->assertUnauthorized();
});

test('support has no dedicated get page', function () {
    $this->actingAs(User::factory()->create())->get('/support')->assertMethodNotAllowed();
    expect(Route::has('support.create'))->toBeFalse();
});

test('the technical contact cannot submit or precognitively validate even with a different email', function (bool $guests, bool $precognitive) {
    config(['support.allow_guests' => $guests, 'queue.default' => 'database']);
    Queue::fake();
    Mail::fake();
    Storage::fake('local');
    $contact = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($contact->id);
    $this->actingAs($contact);
    if ($precognitive) {
        $this->withHeaders(['Precognition' => 'true', 'Precognition-Validate-Only' => 'email']);
    }
    $this->postJson('/support', [
        'subject' => 'Help', 'description' => 'Details of the issue', 'email' => 'different@example.org',
        'attachments' => [UploadedFile::fake()->createWithContent('trace.log', 'trace')],
    ])->assertForbidden();
    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
})->with([[false, false], [false, true], [true, false], [true, true]]);

test('a transfer updates shared button state and backend access for both contacts', function () {
    config(['queue.default' => 'database']);
    Queue::fake();
    Storage::fake('local');
    $first = User::factory()->admin()->create();
    $next = User::factory()->admin()->create();
    $contacts = app(SupportContactManager::class);
    $contacts->assign($first->id);
    $this->actingAs($first)->get('/settings/profile')->assertInertia(fn (Assert $page) => $page
        ->where('support.available', true)->where('support.isTechnicalContact', true));
    $contacts->assign($next->id);
    $this->get('/settings/profile')->assertInertia(fn (Assert $page) => $page
        ->where('support.isTechnicalContact', false));
    $this->from('/settings/profile')->post('/support', [
        'subject' => 'Help', 'description' => 'Details of the issue', 'email' => $next->email,
    ])->assertRedirect('/settings/profile')->assertSessionHasNoErrors();
    $this->actingAs($next)->get('/settings/profile')->assertInertia(fn (Assert $page) => $page
        ->where('support.isTechnicalContact', true));
    $this->postJson('/support', [
        'subject' => 'Help', 'description' => 'Details of the issue', 'email' => $first->email,
    ])->assertForbidden();
    Queue::assertPushed(SendSupportEmail::class, 1);
});
