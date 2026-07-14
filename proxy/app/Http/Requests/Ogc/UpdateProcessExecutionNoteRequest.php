<?php

namespace App\Http\Requests\Ogc;

use App\Support\TiptapDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateProcessExecutionNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
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

    /**
     * @return array<string, mixed>|null
     */
    public function note(): ?array
    {
        $note = $this->validated('note');

        return is_array($note) ? TiptapDocument::sanitize($note) : null;
    }
}
