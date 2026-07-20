<?php

namespace App\Services\Ogc;

use Illuminate\Support\Arr;

class ProcessSchemaNormalizer
{
    public function __construct(
        private ProcessOutputFormatExtractor $outputFormatExtractor,
        private OgcTextNormalizer $textNormalizer,
    ) {}

    /**
     * @param  array<string, mixed>  $process
     * @return array<string, mixed>
     */
    public function normalize(array $process): array
    {
        $processId = (string) $process['id'];
        $inputs = $process['inputs'] ?? [];

        return [
            'id' => $processId,
            'title' => $this->normalizeText($process['title'] ?? $process['id']),
            'description' => $this->normalizeText($process['description'] ?? null),
            'version' => $process['version'] ?? null,
            'jobControlOptions' => $process['jobControlOptions'] ?? [],
            'outputTransmission' => $process['outputTransmission'] ?? [],
            'fields' => $this->normalizeInputs($processId, $inputs),
            'inputValidationSchema' => $this->inputValidationSchema($processId, $inputs),
            'outputs' => $this->normalizeOutputs($process['outputs'] ?? []),
        ];
    }

    /**
     * @param  array<string, mixed>  $inputs
     * @return array<string, mixed>
     */
    private function inputValidationSchema(string $processId, array $inputs): array
    {
        $properties = [];
        $required = [];

        foreach ($inputs as $name => $input) {
            if (! is_array($input)) {
                continue;
            }

            $inputName = (string) $name;
            $schema = is_array($input['schema'] ?? null)
                ? $input['schema']
                : [];
            $properties[$inputName] = [
                ...$schema,
                ...$this->inputValidationConstraints($processId, $inputName),
            ];

            if ((int) ($input['minOccurs'] ?? 0) > 0) {
                $required[] = $inputName;
            }
        }

        return [
            '$schema' => 'https://json-schema.org/draft/2020-12/schema',
            'type' => 'object',
            'properties' => $properties,
            'required' => $required,
            'additionalProperties' => false,
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
                        'label' => $this->variantLabel($variant),
                        'description' => $this->normalizeText($variant['description'] ?? null),
                        'required' => $variant['required'] ?? [],
                        'additionalProperties' => $variant['additionalProperties'] ?? null,
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
            $requiredColumnCount = max(0, (int) ($items['minItems'] ?? 0));

            return [
                ...$this->baseField($name, $schema, $metadata, $processId),
                'kind' => 'array_table',
                'minItems' => $schema['minItems'] ?? null,
                'maxItems' => $schema['maxItems'] ?? null,
                'rowMinItems' => $items['minItems'] ?? null,
                'rowMaxItems' => $items['maxItems'] ?? null,
                'columns' => collect(range(1, $columnCount))
                    ->map(fn (int $column): array => [
                        'key' => (string) ($column - 1),
                        'label' => 'Column '.$column,
                        'type' => Arr::get($items, 'items.type', 'string'),
                        'required' => $column <= $requiredColumnCount,
                        'pattern' => Arr::get($items, 'items.pattern'),
                        'minimum' => Arr::get($items, 'items.minimum'),
                        'maximum' => Arr::get($items, 'items.maximum'),
                        'exclusiveMinimum' => Arr::get($items, 'items.exclusiveMinimum'),
                        'exclusiveMaximum' => Arr::get($items, 'items.exclusiveMaximum'),
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
                'additionalProperties' => $items['additionalProperties'] ?? null,
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
     * @param  array<string, mixed>  $variant
     */
    private function variantLabel(array $variant): string
    {
        $title = $this->normalizeText($variant['title'] ?? null);

        if (is_string($title) && trim($title) !== '') {
            return trim($title);
        }

        $description = $this->normalizeText($variant['description'] ?? null);

        if (
            is_string($description)
            && trim($description) !== ''
            && mb_strlen(trim($description)) <= 80
        ) {
            return trim($description);
        }

        $constantLabels = collect($variant['properties'] ?? [])
            ->map(function (array $schema, string $name): ?string {
                $value = $schema['const'] ?? null;

                if (! array_key_exists('const', $schema) && isset($schema['enum']) && is_array($schema['enum']) && count($schema['enum']) === 1) {
                    $value = $schema['enum'][0];
                }

                if ($value === null) {
                    return null;
                }

                return $name.' = '.$this->formatVariantConstant($value);
            })
            ->filter()
            ->values();

        if ($constantLabels->isNotEmpty()) {
            return $constantLabels->implode(', ');
        }

        $requiredLabels = collect($variant['required'] ?? [])
            ->map(function (string $name) use ($variant): string {
                $title = $this->normalizeText(data_get($variant, "properties.{$name}.title"));

                return is_string($title) && trim($title) !== ''
                    ? trim($title)
                    : $name;
            })
            ->values();

        return $requiredLabels->isNotEmpty()
            ? $requiredLabels->implode(', ')
            : 'Variant';
    }

    private function formatVariantConstant(mixed $value): string
    {
        return match (true) {
            is_bool($value) => $value ? 'true' : 'false',
            is_scalar($value) => (string) $value,
            default => json_encode($value) ?: '',
        };
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
            'title' => $this->normalizeText($metadata['title'] ?? $schema['title'] ?? $name),
            'description' => $this->normalizeText($metadata['description'] ?? $schema['description'] ?? null),
            'minOccurs' => $metadata['minOccurs'] ?? null,
            'maxOccurs' => $metadata['maxOccurs'] ?? null,
            'minimum' => $schema['minimum'] ?? null,
            'maximum' => $schema['maximum'] ?? null,
            'exclusiveMinimum' => $schema['exclusiveMinimum'] ?? null,
            'exclusiveMaximum' => $schema['exclusiveMaximum'] ?? null,
            'pattern' => $schema['pattern'] ?? null,
            'additionalProperties' => $schema['additionalProperties'] ?? null,
            'mediaType' => $schema['contentMediaType'] ?? null,
            'contentEncoding' => $schema['contentEncoding'] ?? null,
            'references' => $processId !== null ? $this->referenceOptions($processId, $name) : [],
            ...($processId !== null ? $this->inputValidationConstraints($processId, $name) : []),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function inputValidationConstraints(string $processId, string $inputName): array
    {
        $constraints = config('services.ogc_processes.input_validation_constraints', []);
        $inputConstraints = $constraints[$processId][$inputName] ?? [];

        return is_array($inputConstraints) ? $inputConstraints : [];
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
            $schema = is_array($output['schema'] ?? null)
                ? $output['schema']
                : [];
            $components = $this->normalizeOutputComponents($schema);

            $normalized[$name] = [
                'name' => $name,
                'title' => $this->normalizeText($output['title'] ?? $name),
                'description' => $this->normalizeText($output['description'] ?? null),
                'mediaType' => $this->mediaTypeFromSchema($schema) ?? $this->firstComponentMediaType($components),
                'contentEncoding' => $schema['contentEncoding'] ?? null,
                'schemaRef' => $schema['$ref'] ?? null,
                'schemaType' => $schema['type'] ?? null,
                'components' => $components,
                'formats' => $this->outputFormatExtractor->formats($schema),
            ];
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @return array<string, array<string, mixed>>
     */
    private function normalizeOutputComponents(array $schema): array
    {
        if (($schema['type'] ?? null) !== 'object' || ! isset($schema['properties']) || ! is_array($schema['properties'])) {
            return [];
        }

        $components = [];

        foreach ($schema['properties'] as $name => $componentSchema) {
            if (! is_array($componentSchema)) {
                continue;
            }

            $components[$name] = [
                'name' => (string) $name,
                'description' => $this->normalizeText($componentSchema['description'] ?? null),
                'mediaType' => $this->mediaTypeFromSchema($componentSchema),
                'schemaRef' => $this->schemaRefFromSchema($componentSchema),
            ];
        }

        return $components;
    }

    /**
     * @param  array<string, array<string, mixed>>  $components
     */
    private function firstComponentMediaType(array $components): ?string
    {
        foreach ($components as $component) {
            $mediaType = $component['mediaType'] ?? null;

            if (is_string($mediaType) && $mediaType !== '') {
                return $mediaType;
            }
        }

        return null;
    }

    private function normalizeText(mixed $value): ?string
    {
        return $this->textNormalizer->normalize(
            is_string($value) ? $value : null,
        );
    }

    /**
     * @param  array<string, mixed>  $schema
     */
    private function mediaTypeFromSchema(array $schema): ?string
    {
        $mediaType = $schema['contentMediaType'] ?? null;

        if (is_string($mediaType) && $mediaType !== '') {
            return $mediaType;
        }

        $const = Arr::get($schema, 'properties.type.const');

        if (is_string($const) && $const !== '') {
            return $const;
        }

        $enum = Arr::get($schema, 'properties.type.enum');

        if (is_array($enum)) {
            foreach ($enum as $value) {
                if (is_string($value) && $value !== '') {
                    return $value;
                }
            }
        }

        foreach ($schema['allOf'] ?? [] as $subSchema) {
            if (! is_array($subSchema)) {
                continue;
            }

            $mediaType = $this->mediaTypeFromSchema($subSchema);

            if ($mediaType !== null) {
                return $mediaType;
            }
        }

        foreach (['oneOf', 'anyOf'] as $compositionKey) {
            foreach ($schema[$compositionKey] ?? [] as $subSchema) {
                if (! is_array($subSchema)) {
                    continue;
                }

                $mediaType = $this->mediaTypeFromSchema($subSchema);

                if ($mediaType !== null) {
                    return $mediaType;
                }
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $schema
     */
    private function schemaRefFromSchema(array $schema): ?string
    {
        $schemaRef = $schema['$ref'] ?? null;

        if (is_string($schemaRef) && $schemaRef !== '') {
            return $schemaRef;
        }

        foreach ($schema['allOf'] ?? [] as $subSchema) {
            if (! is_array($subSchema)) {
                continue;
            }

            $schemaRef = $this->schemaRefFromSchema($subSchema);

            if ($schemaRef !== null) {
                return $schemaRef;
            }
        }

        return null;
    }
}
