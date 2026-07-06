<?php

namespace App\Http\Requests\Ogc;

use App\Enums\Ogc\ExecutionMode;
use App\Support\TiptapDocument;
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

    public function executionMode(): ExecutionMode
    {
        return ExecutionMode::Async;
    }
}
