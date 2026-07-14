<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BulkUserStatusRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
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
            'ids.*' => ['integer', 'distinct:strict', Rule::exists(User::class, 'id')],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $currentUserId = $this->user()?->id;
                $ids = $this->input('ids', []);

                if ($currentUserId === null || ! is_array($ids)) {
                    return;
                }

                $selectedIds = array_map('intval', $ids);

                if (in_array($currentUserId, $selectedIds, true)) {
                    $validator->errors()->add('user', __('You cannot change the status of your own account.'));
                }
            },
        ];
    }

    /**
     * @return list<int>
     */
    public function userIds(): array
    {
        return array_map('intval', $this->validated('ids'));
    }
}
