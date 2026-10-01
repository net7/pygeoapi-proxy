<?php

use App\Enums\UserRole;
use App\Models\ProcessExecution;
use App\Models\User;
use App\Services\Ogc\ProcessExecutionInputSnapshot;
use App\Services\Support\SupportContactManager;
use App\Support\AuthFeatures;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

test('the current contact cannot be demoted or deactivated', function (string $operation, string $field) {
    $admin = User::factory()->admin()->create();
    $contact = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($contact->id);
    DB::table('sessions')->insert([
        'id' => 'contact-session', 'user_id' => $contact->id,
        'payload' => 'test', 'last_activity' => now()->timestamp,
    ]);
    $this->actingAs($admin);
    $response = $operation === 'demote'
        ? $this->patch(route('admin.users.update', $contact), [
            'name' => $contact->name, 'email' => $contact->email, 'role' => 'user',
        ])
        : $this->delete(route('admin.users.destroy', $contact));
    $response->assertSessionHasErrors([
        $field => __('Assign another technical contact before changing this account.'),
    ]);
    expect($contact->fresh()->role)->toBe(UserRole::Admin);
    expect($contact->fresh()->isActive())->toBeTrue();
    $this->assertDatabaseHas('sessions', ['id' => 'contact-session']);
})->with([['demote', 'role'], ['deactivate', 'user']]);

test('a bulk deactivation containing the contact leaves every account and session intact', function () {
    $admin = User::factory()->admin()->create();
    $contact = User::factory()->admin()->create();
    $other = User::factory()->create();
    app(SupportContactManager::class)->assign($contact->id);
    DB::table('sessions')->insert([
        'id' => 'other-session', 'user_id' => $other->id,
        'payload' => 'test', 'last_activity' => now()->timestamp,
    ]);
    $this->actingAs($admin)->delete(route('admin.users.bulk-destroy'), ['ids' => [$other->id, $contact->id]])
        ->assertSessionHasErrors('ids');
    expect($contact->fresh()->isActive())->toBeTrue();
    expect($other->fresh()->isActive())->toBeTrue();
    $this->assertDatabaseHas('sessions', ['id' => 'other-session']);
});

test('permanent deletion of the contact is rejected before deleting jobs files or sessions', function () {
    Http::fake();
    Storage::fake('public');
    $admin = User::factory()->admin()->create();
    $contact = User::factory()->admin()->create(['avatar_path' => 'avatars/contact.jpg']);
    Storage::disk('public')->put('avatars/contact.jpg', 'avatar');
    $execution = ProcessExecution::factory()->for($contact)->create();
    app(SupportContactManager::class)->assign($contact->id);
    DB::table('sessions')->insert([
        'id' => 'contact-session', 'user_id' => $contact->id,
        'payload' => 'test', 'last_activity' => now()->timestamp,
    ]);
    $this->actingAs($admin)->delete(route('admin.users.force-destroy', $contact), [
        'email_confirmation' => $contact->email,
    ])->assertSessionHasErrors('user');
    $this->assertModelExists($contact);
    $this->assertModelExists($execution);
    $this->assertDatabaseHas('sessions', ['id' => 'contact-session']);
    Storage::disk('public')->assertExists('avatars/contact.jpg');
    Http::assertNothingSent();
});

test('self deletion of the contact preserves authentication avatar and input snapshots', function () {
    config(['fortify.features' => [AuthFeatures::accountDeletion()]]);
    Storage::fake('local');
    Storage::fake('public');
    $contact = User::factory()->admin()->create(['avatar_path' => 'avatars/contact.jpg']);
    Storage::disk('public')->put('avatars/contact.jpg', 'avatar');
    $execution = ProcessExecution::factory()->for($contact)->create([
        'input_snapshot' => app(ProcessExecutionInputSnapshot::class)->create([], ['text' => str_repeat('a', 9000)]),
    ]);
    app(SupportContactManager::class)->assign($contact->id);
    $this->actingAs($contact)->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasErrors('user');
    $this->assertAuthenticatedAs($contact);
    $this->assertModelExists($contact);
    $this->assertModelExists($execution);
    Storage::disk('public')->assertExists('avatars/contact.jpg');
    Storage::disk('local')->assertExists($execution->input_snapshot['inputsPath']);
});

test('the former contact can be demoted after an assignment transfer', function () {
    $admin = User::factory()->admin()->create();
    $former = User::factory()->admin()->create();
    $manager = app(SupportContactManager::class);
    $manager->assign($former->id);
    $manager->assign($admin->id);
    $this->actingAs($admin)->patch(route('admin.users.update', $former), [
        'name' => $former->name, 'email' => $former->email, 'role' => 'user',
    ])->assertSessionHasNoErrors();
    expect($former->fresh()->role)->toBe(UserRole::User);
    expect($manager->current()?->id)->toBe($admin->id);
});

test('the contact can still update their name and email without giving up the appointment', function () {
    $contact = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($contact->id);
    $this->actingAs($contact)->patch(route('admin.users.update', $contact), [
        'name' => 'Updated contact', 'email' => 'changed@example.org',
        'email_confirmation' => 'changed@example.org', 'role' => 'admin',
    ])->assertSessionHasNoErrors();
    expect(app(SupportContactManager::class)->current()?->email)->toBe('changed@example.org');
});
