<?php

namespace App\Services\Ogc;

use Illuminate\Support\Arr;

class ProcessSchemaNormalizer
{
    /**
     * @param  array<string, mixed>  $process
     * @return array<string, mixed>
     */
    public function normalize(array $process): array
    {
        return [
            'id' => (string) $process['id'],
            'title' => $process['title'] ?? $process['id'],
            'description' => $process['description'] ?? null,
            'version' => $process['version'] ?? null,
            'jobControlOptions' => $process['jobControlOptions'] ?? [],
            'outputTransmission' => $process['outputTransmission'] ?? [],
            'fields' => $this->normalizeInputs((string) $process['id'], $process['inputs'] ?? []),
            'outputs' => $this->normalizeOutputs($process['outputs'] ?? []),
        ];
    }

    /**
     * @param  array<string, mixed>  $inputs
     * @return array<string, mixed>
     */
    private function normalizeInputs(string $processId, array $inputs): array
    {
        $fields = [];

        foreach ($inputs as $name => $input) {
            $fields[$name] = $this->normalizeField((string) $name, $input['schema'] ?? [], $input, $processId);
        }

        return $fields;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function normalizeField(string $name, array $schema, array $metadata = [], ?string $processId = null): array
    {
        if (isset($schema['oneOf']) && is_array($schema['oneOf'])) {
            return [
                ...$this->baseField($name, $schema, $metadata, $processId),
                'kind' => 'oneOf',
                'variants' => collect($schema['oneOf'])
                    ->values()
                    ->map(fn (array $variant, int $index): array => [
                        'id' => (string) $index,
                        'label' => $variant['title'] ?? $variant['description'] ?? 'Variant '.($index + 1),
                        'description' => $variant['description'] ?? null,
                        'required' => $variant['required'] ?? [],
                        'fields' => $this->normalizeProperties($variant['properties'] ?? [], $variant['required'] ?? []),
                    ])
                    ->all(),
            ];
        }

        if (($schema['type'] ?? null) === 'object') {
            return [
                ...$this->baseField($name, $schema, $metadata, $processId),
                'kind' => 'object',
                'required' => $schema['required'] ?? [],
                'fields' => $this->normalizeProperties($schema['properties'] ?? [], $schema['required'] ?? []),
            ];
        }

        if (($schema['type'] ?? null) === 'array') {
            return $this->normalizeArrayField($name, $schema, $metadata, $processId);
        }

        if (isset($schema['enum'])) {
            return [
                ...$this->baseField($name, $schema, $metadata, $processId),
                'kind' => 'enum',
                'options' => $schema['enum'],
            ];
        }

        return [
            ...$this->baseField($name, $schema, $metadata, $processId),
            'kind' => 'scalar',
            'type' => $schema['type'] ?? 'string',
        ];
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function normalizeArrayField(string $name, array $schema, array $metadata, ?string $processId = null): array
    {
        $items = $schema['items'] ?? [];

        if (($items['type'] ?? null) === 'array') {
            $columnCount = (int) ($items['maxItems'] ?? $items['minItems'] ?? 1);

            return [
                ...$this->baseField($name, $schema, $metadata, $processId),
                'kind' => 'array_table',
                'minItems' => $schema['minItems'] ?? null,
                'maxItems' => $schema['maxItems'] ?? null,
                'columns' => collect(range(1, $columnCount))
                    ->map(fn (int $column): array => [
                        'key' => (string) ($column - 1),
                        'label' => 'Column '.$column,
                        'type' => Arr::get($items, 'items.type', 'string'),
                    ])
                    ->all(),
            ];
        }

        if (($items['type'] ?? null) === 'object') {
            return [
                ...$this->baseField($name, $schema, $metadata, $processId),
                'kind' => 'array_object',
                'minItems' => $schema['minItems'] ?? null,
                'maxItems' => $schema['maxItems'] ?? null,
                'required' => $items['required'] ?? [],
                'fields' => $this->normalizeProperties($items['properties'] ?? [], $items['required'] ?? []),
            ];
        }

        return [
            ...$this->baseField($name, $schema, $metadata, $processId),
            'kind' => 'array_scalar',
            'minItems' => $schema['minItems'] ?? null,
            'maxItems' => $schema['maxItems'] ?? null,
            'itemType' => $items['type'] ?? 'string',
        ];
    }

    /**
     * @param  array<string, mixed>  $properties
     * @param  array<int, string>  $required
     * @return array<string, mixed>
     */
    private function normalizeProperties(array $properties, array $required): array
    {
        $fields = [];

        foreach ($properties as $name => $schema) {
            $fields[$name] = [
                ...$this->normalizeField((string) $name, $schema),
                'required' => in_array($name, $required, true),
            ];
        }

        return $fields;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function baseField(string $name, array $schema, array $metadata, ?string $processId = null): array
    {
        return [
            'name' => $name,
            'title' => $metadata['title'] ?? $schema['title'] ?? $name,
            'description' => $metadata['description'] ?? $schema['description'] ?? null,
            'minOccurs' => $metadata['minOccurs'] ?? null,
            'maxOccurs' => $metadata['maxOccurs'] ?? null,
            'minimum' => $schema['minimum'] ?? null,
            'maximum' => $schema['maximum'] ?? null,
            'exclusiveMinimum' => $schema['exclusiveMinimum'] ?? null,
            'exclusiveMaximum' => $schema['exclusiveMaximum'] ?? null,
            'pattern' => $schema['pattern'] ?? null,
            'mediaType' => $schema['contentMediaType'] ?? null,
            'contentEncoding' => $schema['contentEncoding'] ?? null,
            'references' => $processId !== null ? $this->referenceOptions($processId, $name) : [],
        ];
    }

    /**
     * @return array<int, array{label: string, href: string, mediaType?: string|null}>
     */
    private function referenceOptions(string $processId, string $inputName): array
    {
        $references = config('services.ogc_processes.input_references', []);

        return $references[$processId][$inputName] ?? [];
    }

    /**
     * @param  array<string, mixed>  $outputs
     * @return array<string, mixed>
     */
    private function normalizeOutputs(array $outputs): array
    {
        $normalized = [];

        foreach ($outputs as $name => $output) {
            $schema = $output['schema'] ?? [];

            $normalized[$name] = [
                'name' => $name,
                'title' => $output['title'] ?? $name,
                'description' => $output['description'] ?? null,
                'mediaType' => $schema['contentMediaType'] ?? null,
                'contentEncoding' => $schema['contentEncoding'] ?? null,
                'schemaRef' => $schema['$ref'] ?? null,
            ];
        }

        return $normalized;
    }
}
