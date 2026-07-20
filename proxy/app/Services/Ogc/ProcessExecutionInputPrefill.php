<?php

namespace App\Services\Ogc;

use App\Models\ProcessExecution;

class ProcessExecutionInputPrefill
{
    /**
     * @param  array<string, mixed>  $fields
     * @return array{
     *     sourceJobId: int,
     *     sourceJobName: string,
     *     inputs: array<string, mixed>,
     *     skippedInputs: array<int, string>
     * }
     */
    public function build(ProcessExecution $execution, array $fields): array
    {
        $storedInputs = data_get($execution->request_payload, 'inputs', []);
        $reusableInputs = [];
        $skippedInputs = [];

        if (is_array($storedInputs)) {
            foreach ($storedInputs as $name => $value) {
                $inputName = (string) $name;

                if (
                    ! array_key_exists($inputName, $fields)
                    || $this->containsRedactedValue($value)
                    || ! $this->isReusableInput($fields[$inputName], $value)
                ) {
                    $skippedInputs[] = $inputName;

                    continue;
                }

                $reusableInputs[$inputName] = $value;
            }
        }

        return [
            'sourceJobId' => $execution->id,
            'sourceJobName' => $execution->displayName(),
            'inputs' => $reusableInputs,
            'skippedInputs' => $skippedInputs,
        ];
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function isReusableInput(array $field, mixed $value): bool
    {
        $unwrappedValue = is_array($value)
            && ! array_is_list($value)
            && array_key_exists('value', $value)
                ? $value['value']
                : $value;

        return $this->isReusableFieldValue($field, $unwrappedValue);
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function isReusableFieldValue(array $field, mixed $value): bool
    {
        return match ($field['kind'] ?? 'scalar') {
            'object' => $this->isReusableObject(
                is_array($field['fields'] ?? null) ? $field['fields'] : [],
                $value,
            ),
            'oneOf' => $this->hasReusableVariant($field, $value),
            'array_object' => $this->isReusableObjectArray($field, $value),
            'array_table' => $this->isReusableTable($field, $value),
            'array_scalar' => is_array($value) && array_is_list($value),
            'enum' => $this->matchesOptions($field, $value),
            default => $this->matchesScalarType($field, $value),
        };
    }

    /**
     * @param  array<string, mixed>  $fields
     */
    private function isReusableObject(array $fields, mixed $value): bool
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            return false;
        }

        foreach ($value as $name => $childValue) {
            $childField = $fields[$name] ?? null;

            if (! is_array($childField) || ! $this->isReusableFieldValue($childField, $childValue)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function hasReusableVariant(array $field, mixed $value): bool
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            return false;
        }

        foreach ($field['variants'] ?? [] as $variant) {
            if (! is_array($variant)) {
                continue;
            }

            $fields = is_array($variant['fields'] ?? null) ? $variant['fields'] : [];
            $required = is_array($variant['required'] ?? null) ? $variant['required'] : [];

            $hasRequiredProperties = collect($required)->every(
                fn (mixed $property): bool => is_string($property)
                    && array_key_exists($property, $value),
            );

            if ($hasRequiredProperties && $this->isReusableObject($fields, $value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function isReusableObjectArray(array $field, mixed $value): bool
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return false;
        }

        $fields = is_array($field['fields'] ?? null) ? $field['fields'] : [];

        foreach ($value as $item) {
            if (! $this->isReusableObject($fields, $item)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function isReusableTable(array $field, mixed $value): bool
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return false;
        }

        $columnCount = is_array($field['columns'] ?? null)
            ? count($field['columns'])
            : 0;

        foreach ($value as $row) {
            if (! is_array($row) || ! array_is_list($row) || count($row) > $columnCount) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function matchesOptions(array $field, mixed $value): bool
    {
        $options = is_array($field['options'] ?? null) ? $field['options'] : [];

        if ($options === []) {
            return true;
        }

        foreach ($options as $option) {
            if ($this->valuesAreEqual($option, $value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function matchesScalarType(array $field, mixed $value): bool
    {
        return match ($field['type'] ?? null) {
            'string' => is_string($value),
            'integer' => is_int($value),
            'number' => is_int($value) || is_float($value),
            'boolean' => is_bool($value),
            default => true,
        };
    }

    private function valuesAreEqual(mixed $first, mixed $second): bool
    {
        if ((is_int($first) || is_float($first)) && (is_int($second) || is_float($second))) {
            return (float) $first === (float) $second;
        }

        return $first === $second;
    }

    private function containsRedactedValue(mixed $value): bool
    {
        if ($value === '[redacted inline value]') {
            return true;
        }

        if (! is_array($value)) {
            return false;
        }

        foreach ($value as $childValue) {
            if ($this->containsRedactedValue($childValue)) {
                return true;
            }
        }

        return false;
    }
}
