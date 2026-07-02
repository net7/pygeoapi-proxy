<?php

namespace App\Http\Requests\Ogc;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProcessExecutionNameRequest extends FormRequest
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
}
