<?php

namespace App\Actions\Support;

use App\Jobs\SendSupportEmail;
use App\Models\User;
use App\Services\Support\SupportAttachments;
use App\Services\Support\SupportContactManager;
use App\Support\SupportMailData;
use Illuminate\Contracts\Encryption\EncryptException;
use Illuminate\Queue\InvalidPayloadException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class SubmitSupportEmail
{
    public function __construct(private SupportAttachments $files, private SupportContactManager $contacts) {}

    /** @param array{subject:string,description:string,email:string,attachments?:array|null} $validated */
    public function handle(array $validated, ?User $account): void
    {
        if ($this->contacts->current() === null) {
            throw ValidationException::withMessages(['support' => __('Support is currently unavailable. Please contact an administrator.')]);
        }
        $connection = config('queue.default');
        if (! in_array(config("queue.connections.{$connection}.driver"), ['database', 'redis'], true)) {
            throw ValidationException::withMessages(['support' => __('Your request could not be accepted. Please try again later.')]);
        }

        $id = (string) Str::uuid();
        $acceptedAt = now()->timestamp;
        $expiresAt = $acceptedAt + (int) config('support.retention_seconds');
        try {
            $attachments = $this->files->store($id, $acceptedAt, $expiresAt, $validated['attachments'] ?? []);
        } catch (Throwable $exception) {
            $this->reject($id, 'storage', $exception);
        }
        $data = new SupportMailData(
            id: $id,
            subject: $validated['subject'],
            description: $validated['description'],
            replyTo: $validated['email'],
            acceptedAt: $acceptedAt,
            expiresAt: $expiresAt,
            account: $account?->only(['id', 'name', 'email']),
            attachments: $attachments,
        );
        try {
            Queue::pushOn((string) config('support.queue'), new SendSupportEmail($data));
        } catch (EncryptException|InvalidPayloadException $exception) {
            try {
                $this->files->delete($id);
            } catch (Throwable) {
                Log::warning('Support mail rejected payload cleanup failed.', ['support_id' => $id]);
            }
            $this->reject($id, 'payload', $exception);
        } catch (Throwable $exception) {
            $this->reject($id, 'enqueue', $exception);
        }
    }

    private function reject(string $id, string $operation, Throwable $exception): never
    {
        Log::warning('Support mail acceptance failed.', [
            'support_id' => $id, 'operation' => $operation, 'exception_type' => $exception::class,
        ]);
        throw ValidationException::withMessages([
            'support' => __('Your request could not be accepted. Please try again later.'),
        ]);
    }
}
