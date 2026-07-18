<?php

namespace App\Http\Requests\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Support\TiptapDocument;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

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
            'name' => ['nullable', 'string', 'max:255'],
            'inputs' => ['required', 'array'],
            'outputs' => ['sometimes', 'array'],
            'outputs.*' => ['array:format'],
            'outputs.*.format' => ['sometimes', 'array:mediaType,encoding,schema'],
            'outputs.*.format.mediaType' => [
                'required_with:outputs.*.format',
                'string',
            ],
            'outputs.*.format.encoding' => ['sometimes', 'string'],
            'outputs.*.format.schema' => [
                'sometimes',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value) && ! is_array($value)) {
                        $fail(__('The output format schema must be a string or object.'));
                    }
                },
            ],
            'note' => ['nullable', 'array'],
            'note.type' => ['required_with:note', 'string', 'in:doc'],
            'note.content' => ['sometimes', 'array'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $outputs = $this->input('outputs');

                if (
                    $this->has('outputs')
                    && is_array($outputs)
                    && $outputs !== []
                    && array_is_list($outputs)
                ) {
                    $validator->errors()->add(
                        'outputs',
                        __('The outputs must be an object keyed by output identifier.'),
                    );
                }

                $note = $this->input('note');

                if (! is_array($note)) {
                    return;
                }

                if (TiptapDocument::byteLength($note) > TiptapDocument::MaxBytes) {
                    $validator->errors()->add('note', __('The note is too large.'));
                }
            },
        ];
    }

    public function processName(): ?string
    {
        $name = $this->validated('name');

        if (! is_string($name)) {
            return null;
        }

        $name = trim($name);

        return $name === '' ? null : $name;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function note(): ?array
    {
        $note = $this->validated('note');

        return is_array($note) ? TiptapDocument::sanitize($note) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function executionInputs(): array
    {
        return $this->validated('inputs');
    }

    /**
     * @return array<string, array<string, mixed>>|null
     */
    public function outputSelection(): ?array
    {
        if (! $this->has('outputs')) {
            return null;
        }

        $outputs = $this->validated('outputs');

        return is_array($outputs) ? $outputs : [];
    }

    public function executionMode(): ExecutionMode
    {
        return ExecutionMode::Async;
    }
}
