<?php

namespace App\Jobs;

use App\Mail\SupportEmail;
use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportContactManager;
use App\Support\SupportMailData;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

class SendSupportEmail implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 45;

    public function __construct(public readonly SupportMailData $data)
    {
        $this->onQueue((string) config('support.queue'));
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [60, 300];
    }

    /** @return list<string> */
    public function tags(): array
    {
        return [];
    }

    public function handle(SupportAttachments $files, SupportContactManager $contacts): void
    {
        $lock = Cache::lock('support-mail:'.$this->data->id, (int) config('support.lock_seconds'));
        if (! $lock->get()) {
            $this->release(15);

            return;
        }
        try {
            if ($files->isDelivered($this->data->id)) {
                $this->cleanup($files);

                return;
            }
            if (now()->timestamp >= $this->data->expiresAt) {
                $this->fail(new RuntimeException('Support email has expired.'));

                return;
            }
            try {
                $files->assertPresent($this->data);
            } catch (RuntimeException) {
                $this->fail(new RuntimeException('Support email attachments are unavailable.'));

                return;
            }
            $contact = $contacts->current()
                ?? throw new RuntimeException('Support email has no active technical contact.');
            try {
                Mail::to($contact->email)->send(new SupportEmail($this->data));
            } catch (Throwable) {
                throw new RuntimeException('Support email transport failed.');
            }
            try {
                $files->markDelivered($this->data->id);
            } catch (Throwable) {
                Log::warning('Support mail delivery marker failed.', ['support_id' => $this->data->id]);
            }
            $this->cleanup($files);
        } finally {
            try {
                $lock->release();
            } catch (Throwable) {
                Log::warning('Support mail lock release failed.', ['support_id' => $this->data->id]);
            }
        }
    }

    private function cleanup(SupportAttachments $files): void
    {
        try {
            $files->delete($this->data->id);
        } catch (Throwable) {
            Log::warning('Support mail delivered attachment cleanup failed.', ['support_id' => $this->data->id]);
        }
    }
}
