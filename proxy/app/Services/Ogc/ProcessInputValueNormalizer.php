<?php

namespace App\Services\Ogc;

class ProcessInputValueNormalizer
{
    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, mixed>  $inputs
     * @return array<string, mixed>
     */
    public function normalize(array $fields, array $inputs): array
    {
        $normalized = [];

        foreach ($inputs as $name => $value) {
            $field = $fields[$name] ?? null;

            if (! is_array($field)) {
                $normalized[$name] = $value;

                continue;
            }

            [$included, $normalizedValue] = $this->normalizeField($field, $value);

            if ($included) {
                $normalized[$name] = $normalizedValue;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array{bool, mixed}
     */
    private function normalizeField(array $field, mixed $value): array
    {
        $required = $this->isRequired($field);

        if ($this->isBlankScalar($value)) {
            return $required ? [true, $value] : [false, null];
        }

        return match ($field['kind'] ?? 'scalar') {
            'object' => $this->normalizeObjectField($field, $value, $required),
            'oneOf' => $this->normalizeOneOfField($field, $value, $required),
            'array_object' => $this->normalizeObjectArrayField($field, $value, $required),
            'array_table', 'array_scalar' => is_array($value) && $value === [] && ! $required
                ? [false, null]
                : [true, $value],
            default => [true, $value],
        };
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array{bool, mixed}
     */
    private function normalizeObjectField(array $field, mixed $value, bool $required): array
    {
        $wrapped = is_array($value) && array_key_exists('value', $value);
        $objectValue = $wrapped ? $value['value'] : $value;

        if (! is_array($objectValue) || ($objectValue !== [] && array_is_list($objectValue))) {
            return [true, $value];
        }

        $normalizedValue = $this->normalizeObjectValues(
            is_array($field['fields'] ?? null) ? $field['fields'] : [],
            $objectValue,
        );

        if (! $required && $normalizedValue === []) {
            return [false, null];
        }

        if ($wrapped) {
            $value['value'] = $normalizedValue;

            return [true, $value];
        }

        return [true, $normalizedValue];
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array{bool, mixed}
     */
    private function normalizeOneOfField(array $field, mixed $value, bool $required): array
    {
        if (! is_array($value) || ! array_key_exists('value', $value) || ! is_array($value['value'])) {
            return [true, $value];
        }

        $variantId = $value['variant'] ?? null;
        $variant = collect($field['variants'] ?? [])->first(
            fn (mixed $candidate): bool => is_array($candidate)
                && (string) ($candidate['id'] ?? '') === (string) $variantId,
        );

        if (! is_array($variant)) {
            return [true, $value];
        }

        $value['value'] = $this->normalizeObjectValues(
            is_array($variant['fields'] ?? null) ? $variant['fields'] : [],
            $value['value'],
        );

        return ! $required && $value['value'] === []
            ? [false, null]
            : [true, $value];
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array{bool, mixed}
     */
    private function normalizeObjectArrayField(array $field, mixed $value, bool $required): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return [true, $value];
        }

        if ($value === [] && ! $required) {
            return [false, null];
        }

        $childFields = is_array($field['fields'] ?? null) ? $field['fields'] : [];

        return [
            true,
            array_map(
                fn (mixed $item): mixed => is_array($item) && ($item === [] || ! array_is_list($item))
                    ? $this->normalizeObjectValues($childFields, $item)
                    : $item,
                $value,
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function normalizeObjectValues(array $fields, array $values): array
    {
        $normalized = [];

        foreach ($values as $name => $value) {
            $field = $fields[$name] ?? null;

            if (! is_array($field)) {
                $normalized[$name] = $value;

                continue;
            }

            [$included, $normalizedValue] = $this->normalizeField($field, $value);

            if ($included) {
                $normalized[$name] = $normalizedValue;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function isRequired(array $field): bool
    {
        return ($field['required'] ?? false) === true
            || (int) ($field['minOccurs'] ?? 0) > 0;
    }

    private function isBlankScalar(mixed $value): bool
    {
        return $value === null
            || (is_string($value) && trim($value) === '');
    }
}
