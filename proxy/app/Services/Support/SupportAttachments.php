<?php

namespace App\Services\Support;

use App\Support\SupportMailData;
use DirectoryIterator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use JsonException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Throwable;

class SupportAttachments
{
    /**
     * @param  list<UploadedFile>  $files
     * @return list<array{path:string,name:string,mime:string}>
     */
    public function store(string $id, int $acceptedAt, int $expiresAt, array $files): array
    {
        $directory = $this->directory($id);
        $disk = Storage::disk('local');
        try {
            $this->writeManifest($id, [
                'id' => $id, 'accepted_at' => $acceptedAt,
                'expires_at' => $expiresAt, 'delivered' => false,
            ]);
            $attachments = [];
            foreach ($files as $file) {
                $path = $disk->putFileAs($directory, $file, (string) Str::uuid());
                if ($path === false) {
                    throw new RuntimeException('Support attachment storage failed.');
                }
                $attachments[] = [
                    'path' => $path,
                    'name' => $this->safeName($file->getClientOriginalName()),
                    'mime' => $file->getMimeType() ?? 'application/octet-stream',
                ];
            }

            return $attachments;
        } catch (Throwable $exception) {
            try {
                $this->delete($id);
            } catch (Throwable) {
                Log::warning('Support mail partial storage cleanup failed.', ['support_id' => $id]);
            }
            throw $exception;
        }
    }

    public function assertPresent(SupportMailData $data): void
    {
        if ($this->manifest($data->id) === null) {
            throw new RuntimeException('Support email attachments are unavailable.');
        }
        $directory = $this->directory($data->id);
        foreach ($data->attachments as $attachment) {
            $name = basename($attachment['path']);
            if ($attachment['path'] !== $directory.'/'.$name
                || ! Str::isUuid($name)
                || ! Storage::disk('local')->exists($attachment['path'])) {
                throw new RuntimeException('Support email attachments are unavailable.');
            }
        }
    }

    public function isDelivered(string $id): bool
    {
        return ($this->manifest($id)['delivered'] ?? false) === true;
    }

    public function markDelivered(string $id): void
    {
        $manifest = $this->manifest($id)
            ?? throw new RuntimeException('Support email manifest is unavailable.');
        $manifest['delivered'] = true;
        $this->writeManifest($id, $manifest);
    }

    public function delete(string $id): void
    {
        if (! Storage::disk('local')->deleteDirectory($this->directory($id))) {
            throw new RuntimeException('Support attachment cleanup failed.');
        }
    }

    /** @return iterable<string> */
    public function cleanupCandidates(int $now): iterable
    {
        $root = Storage::disk('local')->path('support-mail');
        if (is_link($root) || ! is_dir($root)) {
            return;
        }
        foreach (new DirectoryIterator($root) as $entry) {
            $id = $entry->getFilename();
            if ($entry->isLink() || ! $entry->isDir() || ! Str::isUuid($id)) {
                continue;
            }
            try {
                $candidate = $this->canDelete($id, $now);
            } catch (Throwable) {
                // Recheck and report this directory under its lock without stopping discovery.
                $candidate = true;
            }
            if ($candidate) {
                yield $id;
            }
        }
    }

    public function canDelete(string $id, int $now): bool
    {
        $directory = Storage::disk('local')->path($this->directory($id));
        if (is_link($directory) || ! is_dir($directory)) {
            return false;
        }
        $latest = 0;
        foreach (new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        ) as $entry) {
            if ($entry->isLink()) {
                return false;
            }
            $latest = max($latest, $entry->getMTime());
        }
        $manifest = $this->manifest($id);
        if ($manifest !== null) {
            return $manifest['delivered'] || $manifest['expires_at'] <= $now;
        }

        return ($latest ?: filemtime($directory)) <= $now - (int) config('support.retention_seconds');
    }

    private function directory(string $id): string
    {
        if (! Str::isUuid($id)) {
            throw new RuntimeException('Invalid support mail identifier.');
        }

        return 'support-mail/'.$id;
    }

    /** @return array{id:string,accepted_at:int,expires_at:int,delivered:bool}|null */
    private function manifest(string $id): ?array
    {
        $raw = Storage::disk('local')->get($this->directory($id).'/manifest.json');
        if ($raw === null) {
            return null;
        }
        try {
            $manifest = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }
        if (! is_array($manifest) || ($manifest['id'] ?? null) !== $id
            || ! is_int($manifest['accepted_at'] ?? null)
            || ! is_int($manifest['expires_at'] ?? null)
            || ! is_bool($manifest['delivered'] ?? null)) {
            return null;
        }

        return $manifest;
    }

    /** @param array{id:string,accepted_at:int,expires_at:int,delivered:bool} $manifest */
    private function writeManifest(string $id, array $manifest): void
    {
        $disk = Storage::disk('local');
        $directory = $this->directory($id);
        $temporary = $directory.'/manifest-'.Str::uuid().'.tmp';
        if (! $disk->put($temporary, json_encode($manifest, JSON_THROW_ON_ERROR))
            || ! $disk->move($temporary, $directory.'/manifest.json')) {
            throw new RuntimeException('Support email metadata storage failed.');
        }
    }

    private function safeName(string $name): string
    {
        $name = basename(str_replace('\\', '/', mb_scrub($name, 'UTF-8')));
        $name = preg_replace('/[\x00-\x1f\x7f]/u', '', $name) ?: 'attachment';
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $stem = pathinfo($name, PATHINFO_FILENAME);

        return Str::limit($stem, max(1, 149 - mb_strlen($extension)), '')
            .($extension === '' ? '' : '.'.$extension);
    }
}
