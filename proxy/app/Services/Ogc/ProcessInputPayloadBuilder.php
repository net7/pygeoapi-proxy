<?php

namespace App\Services\Ogc;

class ProcessInputPayloadBuilder
{
    /**
     * @param  array<string, mixed>  $fields
     * @param  array<string, mixed>  $inputs
     * @return array<string, mixed>
     */
    public function build(array $fields, array $inputs): array
    {
        $payload = [];

        foreach ($inputs as $name => $value) {
            $field = $fields[$name] ?? null;

            if (
                is_array($field)
                && ($field['kind'] ?? null) === 'oneOf'
                && is_array($value)
                && array_key_exists('value', $value)
            ) {
                $payload[$name] = [
                    'value' => $value['value'],
                ];

                continue;
            }

            $payload[$name] = $value;
        }

        return $payload;
    }
}
