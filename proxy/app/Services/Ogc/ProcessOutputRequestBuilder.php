<?php

namespace App\Services\Ogc;

use Illuminate\Validation\ValidationException;

class ProcessOutputRequestBuilder
{
    public function __construct(
        private ProcessOutputFormatExtractor $outputFormatExtractor,
    ) {}

    /**
     * A null selection means a legacy caller omitted outputs and therefore requests all.
     * An empty selection means the caller explicitly requests no outputs.
     *
     * @param  array<string, mixed>  $process
     * @param  array<string, array<string, mixed>>|null  $selection
     * @return array<string, array{format?: array<string, mixed>, transmissionMode: string}>
     */
    public function forProcess(array $process, ?array $selection = null): array
    {
        $availableOutputs = $this->availableOutputs($process);
        $selectedOutputs = $selection ?? array_fill_keys(
            array_keys($availableOutputs),
            [],
        );
        $requests = [];

        foreach ($selectedOutputs as $outputId => $configuration) {
            $outputId = (string) $outputId;
            $output = $availableOutputs[$outputId] ?? null;

            if (! is_array($output)) {
                throw ValidationException::withMessages([
                    "outputs.{$outputId}" => __('This output is not available.'),
                ]);
            }

            if (! is_array($configuration)) {
                throw ValidationException::withMessages([
                    "outputs.{$outputId}" => __('The outputs must be an object keyed by output identifier.'),
                ]);
            }

            $format = $this->formatForOutput(
                outputId: $outputId,
                output: $output,
                configuration: $configuration,
            );

            $requests[$outputId] = [
                ...($format === null ? [] : ['format' => $format]),
                'transmissionMode' => $this->transmissionMode($output),
            ];
        }

        return $requests;
    }

    /**
     * @param  array<string, mixed>  $process
     * @return array<string, array<string, mixed>>
     */
    private function availableOutputs(array $process): array
    {
        $available = [];

        foreach ($process['outputs'] ?? [] as $outputId => $output) {
            if (is_array($output)) {
                $available[(string) $outputId] = $output;
            }
        }

        return $available;
    }

    /**
     * @param  array<string, mixed>  $output
     * @param  array<string, mixed>  $configuration
     * @return array<string, mixed>|null
     */
    private function formatForOutput(
        string $outputId,
        array $output,
        array $configuration,
    ): ?array {
        $schema = is_array($output['schema'] ?? null)
            ? $output['schema']
            : [];
        $formats = $this->outputFormatExtractor->formats($schema);

        if (! array_key_exists('format', $configuration)) {
            return $formats === []
                ? null
                : $this->outputFormatExtractor->requestFormat($formats[0]);
        }

        $requestedFormat = $configuration['format'];

        if (! is_array($requestedFormat)) {
            $this->throwUnknownFormat($outputId);
        }

        foreach ($formats as $format) {
            $trustedFormat = $this->outputFormatExtractor->requestFormat($format);

            if ($this->formatsMatch($requestedFormat, $trustedFormat)) {
                return $trustedFormat;
            }
        }

        return $this->throwUnknownFormat($outputId);
    }

    /**
     * @param  array<string, mixed>  $requested
     * @param  array<string, mixed>  $trusted
     */
    private function formatsMatch(array $requested, array $trusted): bool
    {
        if (array_diff(array_keys($requested), ['mediaType', 'encoding', 'schema']) !== []) {
            return false;
        }

        return $this->canonicalize($requested) === $this->canonicalize($trusted);
    }

    private function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map($this->canonicalize(...), $value);
        }

        $canonical = [];

        foreach ($value as $key => $item) {
            $canonical[$key] = $this->canonicalize($item);
        }

        ksort($canonical);

        return $canonical;
    }

    private function throwUnknownFormat(string $outputId): never
    {
        throw ValidationException::withMessages([
            "outputs.{$outputId}.format" => __('This output format is not available.'),
        ]);
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
