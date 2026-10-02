<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

test('a new appointment replaces the previous contact and is idempotent', function () {
    $actor = User::factory()->admin()->create();
    $first = User::factory()->admin()->create();
    $second = User::factory()->admin()->create();

    $this->actingAs($actor)->put(route('admin.users.technical-contact.update', $first))
        ->assertSessionHasNoErrors()->assertRedirect(route('admin.users.index'));
    $this->assertDatabaseHas('support_settings', ['id' => 1, 'technical_contact_user_id' => $first->id]);
    $this->put(route('admin.users.technical-contact.update', $second))->assertSessionHasNoErrors();
    $this->put(route('admin.users.technical-contact.update', $second))->assertSessionHasNoErrors();

    $this->assertDatabaseCount('support_settings', 1);
    $this->assertDatabaseHas('support_settings', ['id' => 1, 'technical_contact_user_id' => $second->id]);
    expect($first->fresh()->role)->toBe(UserRole::Admin);
    expect($second->fresh()->role)->toBe(UserRole::Admin);
});

test('an active administrator can appoint themselves', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin)->put(route('admin.users.technical-contact.update', $admin))
        ->assertSessionHasNoErrors();
    expect(app(SupportContactManager::class)->current()?->id)->toBe($admin->id);
});

test('guests and ordinary users cannot appoint a contact', function () {
    $contact = User::factory()->admin()->create();
    $this->put(route('admin.users.technical-contact.update', $contact))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->create())
        ->put(route('admin.users.technical-contact.update', $contact))->assertForbidden();
    $this->assertDatabaseHas('support_settings', ['id' => 1, 'technical_contact_user_id' => null]);
});

test('a deactivated administrator cannot appoint a contact', function () {
    $actor = User::factory()->admin()->create(['deactivated_at' => now()]);
    $target = User::factory()->admin()->create();
    $this->actingAs($actor)->put(route('admin.users.technical-contact.update', $target))
        ->assertRedirect(route('account.deactivated'));
    $this->assertDatabaseHas('support_settings', ['id' => 1, 'technical_contact_user_id' => null]);
});

test('only active admins can receive the appointment', function (string $role, bool $inactive) {
    $admin = User::factory()->admin()->create();
    $candidate = User::factory()->create(['role' => $role, 'deactivated_at' => $inactive ? now() : null]);
    $this->actingAs($admin)->put(route('admin.users.technical-contact.update', $candidate))
        ->assertSessionHasErrors(['user' => __('The technical contact must be an active administrator.')]);
    $this->assertDatabaseHas('support_settings', ['id' => 1, 'technical_contact_user_id' => null]);
})->with([['user', false], ['admin', true], ['user', true]]);

test('a missing candidate does not change the existing contact', function () {
    $admin = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($admin->id);
    $this->actingAs($admin)->put(route('admin.users.technical-contact.update', 999999))->assertNotFound();
    expect(app(SupportContactManager::class)->current()?->id)->toBe($admin->id);
});

test('the contact summary is independent of filtered rows', function () {
    $admin = User::factory()->admin()->create(['name' => 'Current Contact']);
    app(SupportContactManager::class)->assign($admin->id);
    $this->actingAs($admin)->get(route('admin.users.index', ['search' => 'NoMatchingUser123']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 0)
            ->where('technicalContact.id', $admin->id)
            ->where('technicalContact.email', $admin->email));
    $this->get(route('admin.users.index'))->assertInertia(fn (Assert $page) => $page
        ->where('users.data.0.is_technical_contact', true));
});

test('an absent or ineligible contact resolves as unavailable', function () {
    $manager = app(SupportContactManager::class);
    expect($manager->current())->toBeNull();
    $admin = User::factory()->admin()->create();
    $manager->assign($admin->id);
    DB::table('users')->where('id', $admin->id)->update(['deactivated_at' => now()]);
    expect($manager->current())->toBeNull();
    DB::table('users')->where('id', $admin->id)->update(['deactivated_at' => null, 'role' => 'user']);
    expect($manager->current())->toBeNull();
});

test('the database enforces the singleton and the contact foreign key', function () {
    $admin = User::factory()->admin()->create();
    app(SupportContactManager::class)->assign($admin->id);
    expect(fn () => DB::table('support_settings')->insert(['id' => 2]))->toThrow(QueryException::class);
    expect(fn () => DB::table('users')->where('id', $admin->id)->delete())->toThrow(QueryException::class);
    $this->assertModelExists($admin);
});
