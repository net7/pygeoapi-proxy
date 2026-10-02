<?php

namespace Tests\Integration;

use App\Models\User;
use App\Services\Support\SupportContactManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\InputStream;

class SupportContactConcurrencyTest extends SupportIntegrationTestCase
{
    public function test_two_appointments_are_serialized_by_the_singleton(): void
    {
        $first = User::factory()->admin()->create();
        $second = User::factory()->admin()->create();
        $results = $this->race('assign', $first->id, 'assign', $second->id);
        $this->assertSame(['OK', 'OK'], $results);
        $this->assertSame($second->id, app(SupportContactManager::class)->current()?->id);
        $this->assertSame(1, DB::table('support_settings')->count());
    }

    #[DataProvider('changes')]
    public function test_appointment_and_account_changes_preserve_a_valid_contact(string $change, bool $appointmentFirst): void
    {
        $candidate = User::factory()->admin()->create(['avatar_path' => 'test-avatar.png']);
        Storage::disk('public')->put('test-avatar.png', 'synthetic avatar');
        $results = $this->race(
            $appointmentFirst ? 'assign' : $change, $candidate->id,
            $appointmentFirst ? $change : 'assign', $candidate->id,
        );
        $this->assertSame(['OK', 'REJECTED'], $results);
        $this->assertSame(1, DB::table('support_settings')->count());
        if ($appointmentFirst) {
            $current = app(SupportContactManager::class)->current();
            $this->assertSame($candidate->id, $current?->id);
            $this->assertTrue($current->isAdmin() && $current->isActive());
            Storage::disk('public')->assertExists('test-avatar.png');
        } else {
            $this->assertNull(app(SupportContactManager::class)->current());
            if ($change === 'delete') {
                $this->assertNull($candidate->fresh());
                Storage::disk('public')->assertMissing('test-avatar.png');
            } elseif ($change === 'deactivate') {
                $this->assertFalse($candidate->fresh()->isActive());
            } else {
                $this->assertFalse($candidate->fresh()->isAdmin());
            }
        }
    }

    public static function changes(): array
    {
        return [
            ['deactivate', true], ['deactivate', false],
            ['demote', true], ['demote', false], ['delete', true], ['delete', false],
        ];
    }

    /** @return list<string> */
    private function race(string $firstAction, int $firstId, string $secondAction, int $secondId): array
    {
        $input = new InputStream;
        $first = $this->fixture([$firstAction, (string) $firstId, 'hold'], $input);
        $this->waitForSignal($first, 'LOCKED');
        $second = $this->fixture([$secondAction, (string) $secondId]);
        $this->waitForSignal($second, 'ATTEMPTING');
        $this->assertTrue($second->isRunning());
        $input->write("continue\n");
        $input->close();
        $this->assertSame(0, $first->wait(), $first->getErrorOutput());
        $this->assertSame(0, $second->wait(), $second->getErrorOutput());

        return array_map(fn ($process): string => trim(explode('RESULT:', $process->getOutput())[1]), [$first, $second]);
    }
}
