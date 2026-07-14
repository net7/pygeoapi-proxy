<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateUserRequest extends FormRequest
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
        /** @var User $user */
        $user = $this->route('user');

        $emailRules = [
            'required',
            'string',
            'lowercase',
            'email',
            'max:255',
            Rule::unique(User::class)->ignore($user),
        ];

        if ($this->emailChanged($user)) {
            $emailRules[] = 'confirmed';
        }

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => $emailRules,
            'email_confirmation' => [
                Rule::requiredIf(fn (): bool => $this->emailChanged($user)),
                'nullable',
                'string',
                'lowercase',
                'email',
                'max:255',
            ],
            'role' => ['required', Rule::enum(UserRole::class)],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $target = $this->route('user');

            if ($target instanceof User
                && $this->user()?->is($target) === true
                && $this->input('role') !== UserRole::Admin->value) {
                $validator->errors()->add('role', __('You cannot remove your own administrator role.'));
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (['email', 'email_confirmation'] as $field) {
            if ($this->has($field)) {
                $normalized[$field] = Str::lower(trim((string) $this->input($field)));
            }
        }

        if ($normalized !== []) {
            $this->merge($normalized);
        }
    }

    private function emailChanged(User $user): bool
    {
        return (string) $this->input('email') !== Str::lower((string) $user->email);
    }
}
