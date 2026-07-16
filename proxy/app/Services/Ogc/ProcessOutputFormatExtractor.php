<?php

namespace App\Services\Ogc;

class ProcessOutputFormatExtractor
{
    /**
     * @param  array<string, mixed>  $schema
     * @return array<int, array{label: string, mediaType: string, encoding?: string, schema?: array<mixed>|string}>
     */
    public function formats(array $schema): array
    {
        $formats = [];
        $seen = [];

        foreach ($this->candidates($schema) as $candidate) {
            $mediaType = $candidate['mediaType'] ?? null;

            if (! is_string($mediaType) || trim($mediaType) === '') {
                continue;
            }

            $mediaType = trim($mediaType);
            $label = $candidate['label'] ?? null;
            $format = [
                'label' => is_string($label) && trim($label) !== '' ? trim($label) : $mediaType,
                'mediaType' => $mediaType,
            ];
            $encoding = $candidate['encoding'] ?? null;

            if (is_string($encoding) && trim($encoding) !== '') {
                $format['encoding'] = trim($encoding);
            }

            if (array_key_exists('schema', $candidate) && $this->isSchemaQualifier($candidate['schema'])) {
                $format['schema'] = is_string($candidate['schema'])
                    ? trim($candidate['schema'])
                    : $candidate['schema'];
            }

            $key = $this->canonicalKey($format);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $formats[] = $format;
        }

        return $formats;
    }

    /**
     * Remove display-only data before placing a trusted format in an OGC execution request.
     *
     * @param  array<string, mixed>  $format
     * @return array{mediaType: string, encoding?: string, schema?: array<mixed>|string}
     */
    public function requestFormat(array $format): array
    {
        $requestFormat = ['mediaType' => $format['mediaType']];

        foreach (['encoding', 'schema'] as $qualifier) {
            if (array_key_exists($qualifier, $format)) {
                $requestFormat[$qualifier] = $format[$qualifier];
            }
        }

        return $requestFormat;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @return array<int, array<string, mixed>>
     */
    private function candidates(array $schema): array
    {
        $candidates = [$this->qualifiers($schema)];

        foreach ($schema['allOf'] ?? [] as $subSchema) {
            if (! is_array($subSchema)) {
                continue;
            }

            $candidates = $this->combine($candidates, $this->candidates($subSchema));
        }

        foreach (['oneOf', 'anyOf'] as $compositionKey) {
            $alternatives = [];

            foreach ($schema[$compositionKey] ?? [] as $subSchema) {
                if (! is_array($subSchema)) {
                    continue;
                }

                array_push($alternatives, ...$this->candidates($subSchema));
            }

            if ($alternatives !== []) {
                $candidates = $this->combine($candidates, $alternatives);
            }
        }

        return $candidates;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    private function qualifiers(array $schema): array
    {
        $qualifiers = [];
        $title = $schema['title'] ?? null;
        $mediaType = $schema['contentMediaType'] ?? null;
        $encoding = $schema['contentEncoding'] ?? null;

        if (is_string($title) && trim($title) !== '') {
            $qualifiers['label'] = trim($title);
        }

        if (is_string($mediaType) && trim($mediaType) !== '') {
            $qualifiers['mediaType'] = trim($mediaType);
        }

        if (is_string($encoding) && trim($encoding) !== '') {
            $qualifiers['encoding'] = trim($encoding);
        }

        $contentSchema = $schema['contentSchema'] ?? null;
        $schemaReference = $schema['$ref'] ?? null;

        if ($this->isSchemaQualifier($contentSchema)) {
            $qualifiers['schema'] = $contentSchema;
        } elseif (is_string($schemaReference) && trim($schemaReference) !== '') {
            $qualifiers['schema'] = trim($schemaReference);
        }

        return $qualifiers;
    }

    /**
     * @param  array<int, array<string, mixed>>  $baseCandidates
     * @param  array<int, array<string, mixed>>  $variantCandidates
     * @return array<int, array<string, mixed>>
     */
    private function combine(array $baseCandidates, array $variantCandidates): array
    {
        $combined = [];

        foreach ($baseCandidates as $baseCandidate) {
            foreach ($variantCandidates as $variantCandidate) {
                $combined[] = array_replace($baseCandidate, $variantCandidate);
            }
        }

        return $combined;
    }

    /**
     * @param  array<string, mixed>  $format
     */
    private function canonicalKey(array $format): string
    {
        $identity = array_intersect_key($format, array_flip(['mediaType', 'encoding', 'schema']));

        return json_encode($this->canonicalize($identity), JSON_THROW_ON_ERROR);
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

    private function isSchemaQualifier(mixed $schema): bool
    {
        return is_array($schema) || (is_string($schema) && trim($schema) !== '');
    }
}
