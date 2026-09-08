<?php

namespace App\Services\Ogc;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use JsonException;
use RuntimeException;

class ProcessExecutionInputSnapshot
{
    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, mixed>  $inputs
     * @param  array<int, array{path: array<int, string>, name: string, content?: string|null, encoding?: string}>  $files
     * @return array{version: int, fields: array<string, mixed>, inputs: array<string, mixed>|null, inputsPath: string|null, files: array<int, array<string, mixed>>}
     */
    public function create(array $fields, array $inputs, array $files = []): array
    {
        $storedFiles = [];
        $fileContents = [];
        $seenPaths = [];

        foreach ([...$files, ...$this->binaryFiles($inputs)] as $file) {
            $pathKey = json_encode($file['path'], JSON_THROW_ON_ERROR);

            if (isset($seenPaths[$pathKey])) {
                continue;
            }

            $value = $this->valueAtPath($inputs, $file['path']);

            if (! is_array($value) || ! array_key_exists('value', $value)) {
                continue;
            }

            $content = array_key_exists('content', $file)
                ? (($file['encoding'] ?? null) === 'base64' ? base64_decode($file['content'] ?? '', true) : ($file['content'] ?? ''))
                : $this->fileContent($inputs, $file['path']);

            if ($content === null || $content === false) {
                continue;
            }

            $seenPaths[$pathKey] = true;
            $fileContents[] = base64_encode($content);
            $storedFiles[] = [
                'path' => $file['path'],
                'name' => $this->fileName($file['name']),
                'sizeBytes' => strlen($content),
                'mediaType' => is_array($value) && is_string($value['mediaType'] ?? null)
                    ? $value['mediaType']
                    : null,
            ];
        }

        $encoded = json_encode(['inputs' => $inputs, 'fileContents' => $fileContents], JSON_THROW_ON_ERROR);
        $path = null;

        if (strlen($encoded) > 8192 || $storedFiles !== []) {
            $path = 'ogc/input-snapshots/'.Str::uuid().'.json';

            if (! Storage::disk('local')->put($path, $encoded)) {
                throw new RuntimeException('Unable to store the submitted input snapshot.');
            }
        }

        return [
            'version' => 1,
            'fields' => $fields,
            'inputs' => $path === null ? $inputs : null,
            'inputsPath' => $path,
            'files' => $storedFiles,
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>|null
     */
    public function inputs(array $snapshot): ?array
    {
        if (is_array($snapshot['inputs'] ?? null)) {
            return $snapshot['inputs'];
        }

        return $this->storedContent($snapshot)['inputs'] ?? null;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function downloadContent(array $snapshot, int $file): ?string
    {
        $content = $this->storedContent($snapshot)['fileContents'][$file] ?? null;

        if (! is_string($content)) {
            return null;
        }

        $decoded = base64_decode($content, true);

        return $decoded === false ? null : $decoded;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array{inputs: array<string, mixed>, fileContents: array<int, string>}|null
     */
    private function storedContent(array $snapshot): ?array
    {
        $path = $snapshot['inputsPath'] ?? null;

        if (! is_string($path) || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        $content = Storage::disk('local')->get($path);

        if (! is_string($content)) {
            return null;
        }

        try {
            $stored = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return is_array($stored) && is_array($stored['inputs'] ?? null) && is_array($stored['fileContents'] ?? null)
            ? $stored
            : null;
    }

    /**
     * @param  array<string, mixed>  $inputs
     * @param  array<int, string>  $path
     */
    public function fileContent(array $inputs, array $path): ?string
    {
        $value = $this->valueAtPath($inputs, $path);
        $encoding = is_array($value) ? ($value['encoding'] ?? null) : null;
        $content = is_array($value) && array_key_exists('value', $value) ? $value['value'] : $value;

        if ($encoding === 'base64' && is_string($content)) {
            $decoded = base64_decode($content, true);

            return $decoded === false ? null : $decoded;
        }

        if (is_array($content) || is_array($value) && str_contains($value['mediaType'] ?? '', 'json')) {
            return json_encode($content, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
        }

        return is_string($content) ? $content : null;
    }

    /**
     * @param  array<string, mixed>  $inputs
     * @param  array<int, string>  $path
     * @return array<int, array{path: array<int, string>, name: string, sizeBytes: int, mediaType: string|null}>
     */
    public function binaryFiles(array $inputs, array $path = []): array
    {
        $files = [];

        foreach ($inputs as $name => $value) {
            if (! is_array($value)) {
                continue;
            }

            $childPath = [...$path, (string) $name];

            if (($value['encoding'] ?? null) === 'base64' && is_string($value['value'] ?? null)) {
                $content = base64_decode($value['value'], true);

                if ($content !== false) {
                    $files[] = [
                        'path' => $childPath,
                        'name' => $this->fileName(implode('-', $childPath).'.bin'),
                        'sizeBytes' => strlen($content),
                        'mediaType' => is_string($value['mediaType'] ?? null) ? $value['mediaType'] : null,
                    ];
                }

                continue;
            }

            $files = [...$files, ...$this->binaryFiles($value, $childPath)];
        }

        return $files;
    }

    /**
     * @param  array<string, mixed>|null  $snapshot
     */
    public function delete(?array $snapshot): void
    {
        $path = $snapshot['inputsPath'] ?? null;

        if (is_string($path)) {
            Storage::disk('local')->delete($path);
        }
    }

    /**
     * @param  array<string, mixed>  $inputs
     * @param  array<int, string>  $path
     */
    private function valueAtPath(array $inputs, array $path): mixed
    {
        $value = $inputs;

        foreach ($path as $key) {
            if (! is_array($value) || ! array_key_exists($key, $value)) {
                return null;
            }

            $value = $value[$key];
        }

        return $value;
    }

    private function fileName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';

        return in_array($name, ['', '.', '..'], true) ? 'input' : $name;
    }
}
