<?php

namespace App\Http\Requests\Ogc;

use App\Enums\Ogc\ExecutionMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProcessExecutionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::enum(ExecutionMode::class)],
            'inputs' => ['required', 'array'],
            'outputs' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function executionPayload(): array
    {
        return array_filter([
            'inputs' => $this->validated('inputs'),
            'outputs' => $this->normalizeOutputs($this->validated('outputs')),
        ], fn (mixed $value): bool => $value !== null);
    }

    public function executionMode(): ExecutionMode
    {
        return ExecutionMode::from((string) $this->validated('mode'));
    }

    /**
     * @param  array<int|string, mixed>|null  $outputs
     * @return array<string, mixed>|null
     */
    private function normalizeOutputs(?array $outputs): ?array
    {
        if ($outputs === null) {
            return null;
        }

        if (array_is_list($outputs)) {
            return collect($outputs)
                ->mapWithKeys(fn (mixed $output): array => [
                    (string) $output => ['transmissionMode' => 'value'],
                ])
                ->all();
        }

        return $outputs;
    }
}
