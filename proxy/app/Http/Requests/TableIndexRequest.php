<?php

namespace App\Http\Requests;

use App\Enums\Ogc\ExecutionStatus;
use App\Enums\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TableIndexRequest extends FormRequest
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
        $userTable = $this->routeIs('admin.users.index');

        return [
            'search' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'status' => ['nullable', Rule::in($userTable
                ? ['all', 'active', 'inactive']
                : ['all', ...array_column(ExecutionStatus::cases(), 'value')])],
            'role' => ['nullable', Rule::in(['all', ...array_column(UserRole::cases(), 'value')])],
            'user' => ['nullable', 'string', 'max:2048'],
        ];
    }

    /** @return array{search: string, status: string, role: string} */
    public function filters(): array
    {
        return [
            'search' => trim($this->validated('search') ?? ''),
            'status' => $this->validated('status') ?? 'all',
            'role' => $this->validated('role') ?? 'all',
        ];
    }
}
