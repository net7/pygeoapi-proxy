<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class ForceDeleteUserRequest extends FormRequest
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
            'email_confirmation' => ['required', 'string', 'lowercase', 'email', 'max:255'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $target = $this->route('user');

                if (! $target instanceof User) {
                    return;
                }

                if ($this->user()?->is($target) === true) {
                    $validator->errors()->add('user', __('You cannot permanently delete your own account.'));
                }

                if ((string) $this->input('email_confirmation') !== Str::lower((string) $target->email)) {
                    $validator->errors()->add('email_confirmation', __('The email confirmation does not match this user.'));
                }
            },
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email_confirmation')) {
            $this->merge([
                'email_confirmation' => Str::lower(trim((string) $this->input('email_confirmation'))),
            ]);
        }
    }
}
