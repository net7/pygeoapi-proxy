<?php

namespace App\Services\Ogc;

use App\Models\ProcessExecution;

class ProcessExecutionInputReview
{
    public function __construct(
        private ProcessExecutionInputSnapshot $snapshots,
        private OgcProcessCache $cache,
        private ProcessSchemaNormalizer $normalizer,
    ) {}

    /**
     * @return array{fields: object, inputs: object, files: array<int, array<string, mixed>>, legacy: bool, unavailableInputs: array<int, string>}
     */
    public function forExecution(ProcessExecution $execution): array
    {
        $snapshot = $execution->input_snapshot;
        $legacy = ! is_array($snapshot);
        $inputs = $legacy
            ? ($execution->request_payload['inputs'] ?? [])
            : $this->snapshots->inputs($snapshot);
        $fields = $legacy ? [] : ($snapshot['fields'] ?? []);

        if ($legacy) {
            $process = $this->cache->process($execution->process_id);

            if ($process !== null && ($process['version'] ?? null) === $execution->process_version) {
                $fields = $this->normalizer->normalize($process)['fields'];
            }
        }

        $unavailable = $inputs === null ? array_keys($fields) : [];
        $availableInputs = [];

        foreach ($inputs ?? [] as $name => $value) {
            $fields[$name] ??= $this->inferField((string) $name, $value);

            if ($legacy && $this->containsRedactedValue($value)) {
                $unavailable[] = (string) $name;

                continue;
            }

            $availableInputs[$name] = $this->hideBinaryContent($value);
        }

        $files = [];

        foreach ($legacy ? $this->snapshots->binaryFiles($inputs ?? []) : ($snapshot['files'] ?? []) as $id => $file) {
            $files[] = [...$file, 'id' => $id, 'available' => $inputs !== null];
        }

        return [
            'fields' => (object) $fields,
            'inputs' => (object) $availableInputs,
            'files' => $files,
            'legacy' => $legacy,
            'unavailableInputs' => $unavailable,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function inferField(string $name, mixed $value): array
    {
        $field = ['name' => $name, 'title' => (string) str($name)->replace('_', ' ')->headline(), 'kind' => 'scalar'];

        if (is_array($value) && ($value['encoding'] ?? null) === 'base64') {
            return [...$field, 'contentEncoding' => 'binary'];
        }

        $value = is_array($value) && array_key_exists('value', $value) ? $value['value'] : $value;

        if (! is_array($value)) {
            return $field;
        }

        if (array_is_list($value)) {
            return [...$field, 'kind' => 'array_scalar'];
        }

        $children = [];

        foreach ($value as $key => $child) {
            $children[$key] = $this->inferField((string) $key, $child);
        }

        return [...$field, 'kind' => 'object', 'fields' => $children];
    }

    private function containsRedactedValue(mixed $value): bool
    {
        if ($value === '[redacted inline value]') {
            return true;
        }

        if (is_array($value)) {
            foreach ($value as $child) {
                if ($this->containsRedactedValue($child)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function hideBinaryContent(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (($value['encoding'] ?? null) === 'base64' && is_string($value['value'] ?? null) && base64_decode($value['value'], true) !== false) {
            return [...$value, 'value' => null];
        }

        return array_map($this->hideBinaryContent(...), $value);
    }
}
