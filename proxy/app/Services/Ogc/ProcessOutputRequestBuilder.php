<?php

namespace App\Services\Ogc;

class ProcessOutputRequestBuilder
{
    /**
     * @param  array<string, mixed>  $process
     * @return array<string, array{transmissionMode: string}>
     */
    public function forProcess(array $process): array
    {
        $outputs = [];

        foreach (($process['outputs'] ?? []) as $outputId => $output) {
            if (! is_array($output)) {
                continue;
            }

            $outputs[(string) $outputId] = [
                'transmissionMode' => $this->transmissionMode($output),
            ];
        }

        return $outputs;
    }

    /**
     * @param  array<string, mixed>  $output
     */
    private function transmissionMode(array $output): string
    {
        return $this->hasInlineMediaType($output['schema'] ?? []) ? 'value' : 'reference';
    }

    private function hasInlineMediaType(mixed $schema): bool
    {
        if (! is_array($schema)) {
            return false;
        }

        $mediaType = $this->baseMediaType($schema['contentMediaType'] ?? null);

        if ($this->isInlineMediaType($mediaType)) {
            return true;
        }

        foreach (['oneOf', 'anyOf', 'allOf'] as $compositionKey) {
            foreach (($schema[$compositionKey] ?? []) as $subSchema) {
                if ($this->hasInlineMediaType($subSchema)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isInlineMediaType(?string $mediaType): bool
    {
        return $mediaType === 'text/plain'
            || $mediaType === 'application/json'
            || ($mediaType !== null && str_ends_with($mediaType, '+json'));
    }

    private function baseMediaType(mixed $mediaType): ?string
    {
        if (! is_string($mediaType) || trim($mediaType) === '') {
            return null;
        }

        return strtolower(trim(strtok($mediaType, ';') ?: $mediaType));
    }
}
