<?php

namespace App\Services\Ogc;

class ProcessInputValidator
{
    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, mixed>  $inputs
     * @return array<string, string>
     */
    public function errors(array $fields, array $inputs): array
    {
        $errors = [];

        foreach ($fields as $name => $field) {
            if (! is_array($field)) {
                continue;
            }

            $hasValue = array_key_exists($name, $inputs) && ! $this->isBlank($inputs[$name]);
            $path = "inputs.{$name}";

            if (! $hasValue) {
                if ((int) ($field['minOccurs'] ?? 0) > 0) {
                    $errors[$path] = __('This input is required.');
                }

                continue;
            }

            $this->validateField($field, $inputs[$name], $path, $errors);
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateField(array $field, mixed $value, string $path, array &$errors): void
    {
        $kind = $field['kind'] ?? 'scalar';

        match ($kind) {
            'object' => $this->validateWrappedObject($field, $value, $path, $errors),
            'oneOf' => $this->validateOneOf($field, $value, $path, $errors),
            'array_object' => $this->validateArrayObject($field, $value, $path, $errors),
            'array_table' => $this->validateArrayTable($field, $value, $path, $errors),
            'enum' => $this->validateEnum($field, $value, $path, $errors),
            default => $this->validateScalar($field, $value, $path, $errors),
        };
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateWrappedObject(array $field, mixed $value, string $path, array &$errors): void
    {
        if (is_array($value) && array_key_exists('value', $value)) {
            $this->validateObject(
                $field,
                $value['value'],
                $path.'.value',
                $errors,
            );

            return;
        }

        $this->validateObject($field, $value, $path, $errors);
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateObject(array $field, mixed $value, string $path, array &$errors): void
    {
        if (! is_array($value)) {
            $errors[$path] = __('This input must be an object.');

            return;
        }

        foreach (($field['fields'] ?? []) as $childName => $childField) {
            if (! is_array($childField)) {
                continue;
            }

            $childPath = "{$path}.{$childName}";
            $hasValue = array_key_exists($childName, $value) && ! $this->isBlank($value[$childName]);

            if (! $hasValue) {
                if (($childField['required'] ?? false) === true) {
                    $errors[$childPath] = __('This input is required.');
                }

                continue;
            }

            $this->validateField($childField, $value[$childName], $childPath, $errors);
        }
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateOneOf(array $field, mixed $value, string $path, array &$errors): void
    {
        if (! is_array($value)) {
            $errors[$path] = __('This input must be an object.');

            return;
        }

        $hasWrappedValue = array_key_exists('value', $value);
        $objectValue = $hasWrappedValue ? $value['value'] : $value;
        $objectPath = $hasWrappedValue ? $path.'.value' : $path;

        if (! is_array($objectValue)) {
            $errors[$objectPath] = __('This input must be an object.');

            return;
        }

        if (array_key_exists('variant', $value)) {
            $variantId = $value['variant'];

            if (! is_string($variantId) && ! is_int($variantId)) {
                $errors[$path.'.variant'] = __(
                    'This input does not match an available option.',
                );

                return;
            }

            $variant = collect($field['variants'] ?? [])
                ->first(
                    fn (mixed $candidate): bool => is_array($candidate)
                        && (string) ($candidate['id'] ?? '') === (string) $variantId,
                );

            if (! is_array($variant)) {
                $errors[$path.'.variant'] = __(
                    'This input does not match an available option.',
                );

                return;
            }
        } else {
            $variant = $this->matchingVariant($field, $objectValue);

            if ($variant === null) {
                $errors[$path] = __(
                    'This input does not match an available option.',
                );

                return;
            }
        }

        $this->validateObject(
            ['fields' => $variant['fields'] ?? []],
            $objectValue,
            $objectPath,
            $errors,
        );
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, mixed>  $value
     * @return array<string, mixed>|null
     */
    private function matchingVariant(array $field, array $value): ?array
    {
        $matches = collect($field['variants'] ?? [])
            ->filter(function (mixed $variant) use ($value): bool {
                if (! is_array($variant)) {
                    return false;
                }

                $required = array_filter(
                    $variant['required'] ?? [],
                    'is_string',
                );

                return collect($required)->every(
                    fn (string $key): bool => array_key_exists($key, $value)
                        && ! $this->isBlank($value[$key]),
                );
            })
            ->values();

        return $matches->count() === 1 && is_array($matches->first())
            ? $matches->first()
            : null;
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateArrayObject(array $field, mixed $value, string $path, array &$errors): void
    {
        if (! is_array($value)) {
            $errors[$path] = __('This input must be an array.');

            return;
        }

        $this->validateArrayCount($field, $value, $path, $errors);

        foreach (array_values($value) as $index => $row) {
            $this->validateObject($field, $row, "{$path}.{$index}", $errors);
        }
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateArrayTable(array $field, mixed $value, string $path, array &$errors): void
    {
        if (! is_array($value)) {
            $errors[$path] = __('This input must be an array.');

            return;
        }

        $this->validateArrayCount($field, $value, $path, $errors);

        foreach (array_values($value) as $rowIndex => $row) {
            if (! is_array($row)) {
                $errors["{$path}.{$rowIndex}"] = __('This row must be an array.');

                continue;
            }

            foreach (($field['columns'] ?? []) as $columnIndex => $column) {
                if (! is_array($column)) {
                    continue;
                }

                $cellPath = "{$path}.{$rowIndex}.{$columnIndex}";
                $cellValue = $row[$columnIndex] ?? null;

                if (
                    ($column['required'] ?? false) === true
                    && $this->isBlank($cellValue)
                ) {
                    $errors[$cellPath] = __('This input is required.');

                    continue;
                }

                $this->validateScalar(
                    $column,
                    $cellValue,
                    $cellPath,
                    $errors,
                );
            }
        }
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<int|string, mixed>  $value
     * @param  array<string, string>  $errors
     */
    private function validateArrayCount(array $field, array $value, string $path, array &$errors): void
    {
        $count = count($value);

        if (isset($field['minItems']) && $field['minItems'] !== null && $count < (int) $field['minItems']) {
            $errors[$path] = __('This input has too few items.');
        }

        if (isset($field['maxItems']) && $field['maxItems'] !== null && $count > (int) $field['maxItems']) {
            $errors[$path] = __('This input has too many items.');
        }
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateEnum(array $field, mixed $value, string $path, array &$errors): void
    {
        if (! in_array($value, $field['options'] ?? [], true)) {
            $errors[$path] = __('This input must be one of the available options.');
        }
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateScalar(array $field, mixed $value, string $path, array &$errors): void
    {
        if ($this->isBlank($value)) {
            return;
        }

        if (in_array($field['type'] ?? null, ['number', 'integer'], true)) {
            $this->validateNumber($field, $value, $path, $errors);
        }

        $pattern = $field['pattern'] ?? null;

        if (is_string($pattern) && $pattern !== '' && preg_match($this->regex($pattern), (string) $value) !== 1) {
            $errors[$path] = __('This input format is invalid.');
        }
    }

    /**
     * @param  array<string, mixed>  $field
     * @param  array<string, string>  $errors
     */
    private function validateNumber(array $field, mixed $value, string $path, array &$errors): void
    {
        if (! is_numeric($value)) {
            $errors[$path] = __('This input must be a number.');

            return;
        }

        $number = (float) $value;

        if (isset($field['minimum']) && $field['minimum'] !== null && $number < (float) $field['minimum']) {
            $errors[$path] = __('This input is below the minimum value.');
        }

        if (isset($field['maximum']) && $field['maximum'] !== null && $number > (float) $field['maximum']) {
            $errors[$path] = __('This input is above the maximum value.');
        }

        if (isset($field['exclusiveMinimum']) && $field['exclusiveMinimum'] !== null && $number <= (float) $field['exclusiveMinimum']) {
            $errors[$path] = __('This input must be greater than the minimum value.');
        }

        if (isset($field['exclusiveMaximum']) && $field['exclusiveMaximum'] !== null && $number >= (float) $field['exclusiveMaximum']) {
            $errors[$path] = __('This input must be less than the maximum value.');
        }
    }

    private function isBlank(mixed $value): bool
    {
        return $value === null || $value === '' || $value === [];
    }

    private function regex(string $pattern): string
    {
        return '~'.$pattern.'~u';
    }
}
