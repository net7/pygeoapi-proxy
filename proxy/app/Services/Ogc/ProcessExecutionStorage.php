<?php

namespace App\Services\Ogc;

use App\Enums\Ogc\ResultCacheStatus;
use App\Models\ProcessExecution;
use FilesystemIterator;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ProcessExecutionStorage
{
    /**
     * @return array{totalSizeBytes: int, fileCount: int, databaseResultCount: int, roots: array, inspectedAt: string}
     */
    public function forExecution(ProcessExecution $execution): array
    {
        clearstatcache();

        $directory = "ogc-results/{$execution->id}";
        $results = $this->directory($directory);
        $results['name'] = $directory;
        $roots = [$results];
        $snapshotPath = $execution->input_snapshot['inputsPath'] ?? null;

        if (is_string($snapshotPath) && preg_match('#\Aogc/input-snapshots/[a-zA-Z0-9-]+\.json\z#', $snapshotPath)) {
            $snapshot = $this->file($snapshotPath);

            if ($snapshot !== null) {
                $inputs = $this->emptyDirectory('ogc/input-snapshots');
                $inputs['name'] = $inputs['path'];
                $inputs['children'] = [$snapshot];
                $inputs['sizeBytes'] = $snapshot['sizeBytes'];
                $inputs['fileCount'] = 1;
                $roots[] = $inputs;
            }
        }

        return [
            'totalSizeBytes' => array_sum(array_column($roots, 'sizeBytes')),
            'fileCount' => array_sum(array_column($roots, 'fileCount')),
            'databaseResultCount' => $execution->results()
                ->whereIn('cache_status', [ResultCacheStatus::Cached->value, ResultCacheStatus::MetadataOnly->value])
                ->whereNull('storage_path')
                ->whereNotNull('preview')
                ->count(),
            'roots' => $roots,
            'inspectedAt' => now()->toIso8601String(),
        ];
    }

    public function deleteResults(ProcessExecution $execution): void
    {
        clearstatcache();

        $directory = "ogc-results/{$execution->id}";
        $absolutePath = $this->safePath($directory);

        if ($absolutePath === null || ! is_dir($absolutePath)) {
            return;
        }

        if (! Storage::disk('local')->deleteDirectory($directory)) {
            throw new RuntimeException('Unable to delete job result files.');
        }
    }

    /**
     * @return array{name: string, path: string, type: string, sizeBytes: int, fileCount: int, children: array}
     */
    private function directory(string $path): array
    {
        $node = $this->emptyDirectory($path);
        $absolutePath = $this->safePath($path);

        if ($absolutePath === null || ! is_dir($absolutePath)) {
            return $node;
        }

        foreach (new FilesystemIterator($absolutePath) as $entry) {
            if ($entry->isLink()) {
                continue;
            }

            $childPath = $path.'/'.$entry->getFilename();
            $child = $entry->isDir()
                ? $this->directory($childPath)
                : $this->file($childPath);

            if ($child !== null) {
                $node['children'][] = $child;
                $node['sizeBytes'] += $child['sizeBytes'];
                $node['fileCount'] += $child['fileCount'];
            }
        }

        usort($node['children'], function (array $left, array $right): int {
            return ($left['type'] === 'file') <=> ($right['type'] === 'file')
                ?: strnatcasecmp($left['name'], $right['name'])
                ?: strcmp($left['name'], $right['name']);
        });

        return $node;
    }

    /**
     * @return array{name: string, path: string, type: string, sizeBytes: int, fileCount: int, children: array}|null
     */
    private function file(string $path): ?array
    {
        $absolutePath = $this->safePath($path);

        if ($absolutePath === null || ! is_file($absolutePath)) {
            return null;
        }

        $size = @filesize($absolutePath);

        if ($size === false) {
            throw new RuntimeException('Unable to read a job file size.');
        }

        return [
            'name' => basename($path),
            'path' => $path,
            'type' => 'file',
            'sizeBytes' => $size,
            'fileCount' => 1,
            'children' => [],
        ];
    }

    private function safePath(string $path): ?string
    {
        $absolutePath = rtrim(Storage::disk('local')->path(''), DIRECTORY_SEPARATOR);

        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..' || str_contains($part, '\\')) {
                return null;
            }

            $absolutePath .= DIRECTORY_SEPARATOR.$part;

            if (is_link($absolutePath)) {
                return null;
            }
        }

        return $absolutePath;
    }

    /**
     * @return array{name: string, path: string, type: string, sizeBytes: int, fileCount: int, children: array}
     */
    private function emptyDirectory(string $path): array
    {
        return [
            'name' => basename($path),
            'path' => $path,
            'type' => 'directory',
            'sizeBytes' => 0,
            'fileCount' => 0,
            'children' => [],
        ];
    }
}
