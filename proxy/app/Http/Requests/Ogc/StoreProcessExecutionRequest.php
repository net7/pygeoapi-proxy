<?php

namespace App\Http\Requests\Ogc;

use App\Enums\Ogc\ExecutionMode;
use Illuminate\Foundation\Http\FormRequest;

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
        return ExecutionMode::Async;
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
