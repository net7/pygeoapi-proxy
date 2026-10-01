<?php

use App\Jobs\SendSupportEmail;
use App\Mail\SupportEmail;
use App\Models\User;
use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportContactManager;
use App\Support\SupportMailData;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Http\UploadedFile;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

function supportDeliveryData(array $files = [], ?int $expiresAt = null): SupportMailData
{
    $id = (string) Str::uuid();
    $expiresAt ??= now()->addDays(7)->timestamp;

    return new SupportMailData(
        id: $id, subject: 'A result problem', description: '<script>alert(1)</script>',
        replyTo: 'reply@example.org', acceptedAt: now()->timestamp, expiresAt: $expiresAt,
        account: ['id' => 42, 'name' => 'Authenticated person', 'email' => 'account@example.org'],
        attachments: app(SupportAttachments::class)->store($id, now()->timestamp, $expiresAt, $files),
    );
}

test('delivery uses the latest contact and the declared reply address without sending a second job', function () {
    Storage::fake('local');
    Mail::fake();
    $contacts = app(SupportContactManager::class);
    $first = User::factory()->admin()->create();
    $next = User::factory()->admin()->create();
    $contacts->assign($first->id);
    $data = supportDeliveryData([UploadedFile::fake()->createWithContent('trace.log', "error\n")]);
    $contacts->assign($next->id);
    app()->call([new SendSupportEmail($data), 'handle']);

    Mail::assertSent(SupportEmail::class, fn (SupportEmail $mail): bool => $mail->hasTo($next->email) && ! $mail->hasTo($first->email)
        && $mail->envelope()->replyTo[0]->address === 'reply@example.org');
    Mail::assertSentCount(1);
    Mail::assertNothingQueued();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});

test('the message escapes html but preserves plain text identity and attachments', function () {
    Storage::fake('local');
    config(['mail.from.address' => 'app@example.org', 'mail.from.name' => 'Application']);
    $data = supportDeliveryData([UploadedFile::fake()->createWithContent("trace\r\n.log", 'diagnostics')]);
    expect($data->attachments[0])->toMatchArray(['name' => 'trace.log', 'mime' => 'text/plain']);
    $mail = new SupportEmail($data);
    expect($mail->render())->toContain('&lt;script&gt;', 'account@example.org', 'reply@example.org', 'Authenticated person')
        ->not->toContain('<script>');
    $mail->assertSeeInText('<script>alert(1)</script>');
    $mail->assertHasAttachedData('diagnostics', 'trace.log', ['mime' => 'text/plain']);
    expect($mail->envelope()->from->address)->toBe('app@example.org');
    expect($mail->envelope()->subject)->toBe('[Assistenza] A result problem');
    expect($mail->envelope()->cc)->toBe([]);
    expect($mail->envelope()->bcc)->toBe([]);
});

test('expired support jobs fail without sending even on a manual retry', function () {
    Storage::fake('local');
    Mail::fake();
    $this->freezeTime();
    $data = supportDeliveryData(expiresAt: now()->timestamp);
    $job = (new SendSupportEmail($data))->withFakeQueueInteractions();
    app()->call([$job, 'handle']);
    $job->assertFailedWith(new RuntimeException('Support email has expired.'));
    Mail::assertNothingSent();
});

test('missing attachments fail the whole message without partial delivery', function () {
    Storage::fake('local');
    Mail::fake();
    $data = supportDeliveryData([UploadedFile::fake()->createWithContent('trace.log', 'trace')]);
    Storage::disk('local')->delete($data->attachments[0]['path']);
    $job = (new SendSupportEmail($data))->withFakeQueueInteractions();
    app()->call([$job, 'handle']);
    $job->assertFailedWith(new RuntimeException('Support email attachments are unavailable.'));
    Mail::assertNothingSent();
});

test('an unavailable contact leaves attachments for recovery', function () {
    Storage::fake('local');
    Mail::fake();
    $data = supportDeliveryData();
    expect(fn () => app()->call([new SendSupportEmail($data), 'handle']))->toThrow(RuntimeException::class);
    Storage::disk('local')->assertExists('support-mail/'.$data->id.'/manifest.json');
    Mail::assertNothingSent();
});

test('transport failures preserve files and a later attempt uses the new contact', function () {
    Storage::fake('local');
    $first = User::factory()->admin()->create();
    $next = User::factory()->admin()->create();
    $contacts = app(SupportContactManager::class);
    $contacts->assign($first->id);
    $data = supportDeliveryData([UploadedFile::fake()->createWithContent('trace.log', 'trace')]);
    $mailer = Mail::getFacadeRoot();
    $pending = Mockery::mock(PendingMail::class);
    $pending->shouldReceive('send')->once()->andThrow(new RuntimeException('Sensitive transport diagnostic'));
    Mail::shouldReceive('to')->with($first->email)->once()->andReturn($pending);
    expect(fn () => app()->call([new SendSupportEmail($data), 'handle']))
        ->toThrow(RuntimeException::class, 'Support email transport failed.');
    Storage::disk('local')->assertExists($data->attachments[0]['path']);
    $contacts->assign($next->id);
    Mail::swap($mailer);
    Mail::fake();
    app()->call([new SendSupportEmail($data), 'handle']);
    Mail::assertSent(SupportEmail::class, fn ($mail): bool => $mail->hasTo($next->email));
    Mail::assertSentCount(1);
});

test('cleanup failures after delivery do not send the email again', function () {
    Storage::fake('local');
    Mail::fake();
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    $data = supportDeliveryData();
    $this->partialMock(SupportAttachments::class, function ($mock): void {
        $mock->shouldReceive('delete')->twice()->andThrow(new RuntimeException('Synthetic filesystem error'));
    });
    app()->call([new SendSupportEmail($data), 'handle']);
    expect(app(SupportAttachments::class)->isDelivered($data->id))->toBeTrue();
    app()->call([new SendSupportEmail($data), 'handle']);
    Mail::assertSentCount(1);
});

test('a concurrent cleanup lock postpones delivery without reading or sending files', function () {
    Storage::fake('local');
    Mail::fake();
    $data = supportDeliveryData();
    $lock = Cache::lock('support-mail:'.$data->id, 75);
    $lock->get();
    try {
        $job = (new SendSupportEmail($data))->withFakeQueueInteractions();
        app()->call([$job, 'handle']);
        $job->assertReleased();
        Mail::assertNothingSent();
    } finally {
        $lock->release();
    }
});

test('failure to release the lock after delivery does not turn success into a retry', function () {
    Storage::fake('local');
    Mail::fake();
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    $data = supportDeliveryData();
    $lock = Mockery::mock(Lock::class);
    $lock->shouldReceive('get')->once()->andReturn(true);
    $lock->shouldReceive('release')->once()->andThrow(new RuntimeException('Synthetic cache failure'));
    Cache::shouldReceive('lock')->with('support-mail:'.$data->id, 75)->once()->andReturn($lock);
    app()->call([new SendSupportEmail($data), 'handle']);
    Mail::assertSentCount(1);
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});

test('temporary storage selects expired and delivered requests but preserves active files', function () {
    Storage::fake('local');
    $files = app(SupportAttachments::class);
    $active = (string) Str::uuid();
    $expired = (string) Str::uuid();
    $delivered = (string) Str::uuid();
    $files->store($active, now()->timestamp, now()->addDays(7)->timestamp, []);
    $files->store($expired, now()->subDays(8)->timestamp, now()->subDay()->timestamp, []);
    $files->store($delivered, now()->timestamp, now()->addDays(7)->timestamp, []);
    $files->markDelivered($delivered);
    Storage::disk('local')->put('other-data/keep.txt', 'keep');
    expect(iterator_to_array($files->cleanupCandidates(now()->timestamp)))
        ->toEqualCanonicalizing([$expired, $delivered]);
    Storage::disk('local')->assertExists('other-data/keep.txt');
});
