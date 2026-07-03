<?php

use App\Enums\Ogc\ExecutionStatus;
use App\Models\ProcessExecution;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;

afterEach(function () {
    Carbon::setTestNow();
});

function jobNoteDocument(string $text): array
{
    return [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => $text],
                ],
            ],
        ],
    ];
}

test('job owners can update notes while a job is still running', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 11:00:00'));

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'status' => ExecutionStatus::Running,
        'note' => null,
        'note_updated_at' => null,
    ]);

    $note = jobNoteDocument('Watch this run before sharing output.');

    $this->actingAs($user)
        ->from(route('jobs.show', $execution))
        ->patch(route('jobs.note.update', $execution), ['note' => $note])
        ->assertRedirect(route('jobs.show', $execution))
        ->assertInertiaFlash('toast.title', 'Note saved');

    $execution->refresh();

    expect($execution->note)->toBe($note)
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T11:00:00+00:00');
});

test('admins can update notes for another users job', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 12:30:00'));

    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'note' => jobNoteDocument('Original owner note.'),
        'note_updated_at' => CarbonImmutable::parse('2026-07-01 08:00:00'),
    ]);

    $note = jobNoteDocument('Admin reviewed the running job.');

    $this->actingAs($admin)
        ->patch(route('jobs.note.update', $execution), ['note' => $note])
        ->assertRedirect();

    $execution->refresh();

    expect($execution->note)->toBe($note)
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T12:30:00+00:00');
});

test('notes preserve code blocks', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();
    $note = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    ['type' => 'text', 'text' => 'Check this payload:'],
                ],
            ],
            [
                'type' => 'codeBlock',
                'content' => [
                    ['type' => 'text', 'text' => '<example>value</example>'],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->patch(route('jobs.note.update', $execution), ['note' => $note])
        ->assertRedirect();

    expect($execution->refresh()->note)->toBe($note);
});

test('users cannot update another users note', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $execution = ProcessExecution::factory()->for($owner)->create([
        'note' => jobNoteDocument('Owner note.'),
    ]);

    $this->actingAs($otherUser)
        ->patch(route('jobs.note.update', $execution), ['note' => jobNoteDocument('Tampered note.')])
        ->assertForbidden();

    expect($execution->refresh()->note)->toBe(jobNoteDocument('Owner note.'));
});

test('empty note updates clear the document and update the note timestamp', function () {
    Carbon::setTestNow(CarbonImmutable::parse('2026-07-01 13:45:00'));

    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create([
        'note' => jobNoteDocument('Remove this.'),
        'note_updated_at' => CarbonImmutable::parse('2026-07-01 09:00:00'),
    ]);

    $this->actingAs($user)
        ->patch(route('jobs.note.update', $execution), [
            'note' => [
                'type' => 'doc',
                'content' => [
                    [
                        'type' => 'paragraph',
                        'content' => [
                            ['type' => 'text', 'text' => '   '],
                        ],
                    ],
                ],
            ],
        ])
        ->assertRedirect();

    $execution->refresh();

    expect($execution->note)->toBeNull()
        ->and($execution->note_updated_at?->toIso8601String())->toBe('2026-07-01T13:45:00+00:00');
});

test('oversized note documents are rejected', function () {
    $user = User::factory()->create();
    $execution = ProcessExecution::factory()->for($user)->create();

    $this->actingAs($user)
        ->patch(route('jobs.note.update', $execution), [
            'note' => jobNoteDocument(str_repeat('A', 70000)),
        ])
        ->assertSessionHasErrors('note');
});
