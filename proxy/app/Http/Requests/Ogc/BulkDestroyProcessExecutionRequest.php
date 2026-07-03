<?php

namespace App\Http\Requests\Ogc;

use App\Models\ProcessExecution;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkDestroyProcessExecutionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
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
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct:strict', Rule::exists(ProcessExecution::class, 'id')],
        ];
    }

    /**
     * @return list<int>
     */
    public function executionIds(): array
    {
        return array_map('intval', $this->validated('ids'));
    }
}
