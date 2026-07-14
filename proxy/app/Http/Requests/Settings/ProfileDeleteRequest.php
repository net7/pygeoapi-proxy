<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\Support\AuthFeatures;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProfileDeleteRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        if (! AuthFeatures::enabled(AuthFeatures::accountDeletion())) {
            return [];
        }

        if (! $this->user()->hasLocalPassword()) {
            return [];
        }

        return [
            'password' => $this->currentPasswordRules(),
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        if (! AuthFeatures::enabled(AuthFeatures::accountDeletion())) {
            return [];
        }

        return [
            function (Validator $validator): void {
                if ($this->user()->hasLocalPassword()) {
                    return;
                }

                $confirmedAt = (int) $this->session()->get('auth.email_otp_confirmed_at', 0);

                if ($confirmedAt < now()->subMinutes(10)->timestamp) {
                    $validator->errors()->add('otp', __('Please confirm this action with an email code.'));
                }
            },
        ];
    }
}
