<?php

namespace App\Http\Requests;

use App\Rules\SupportAttachmentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class StoreSupportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null || config('support.allow_guests') === true;
    }

    public function rules(): array
    {
        $rules = [
            'subject' => ['bail', 'required', 'string', 'max:200', 'not_regex:/[\r\n]/'],
            'description' => ['bail', 'required', 'string', 'max:10000'],
            'email' => ['bail', 'required', 'string', 'email:strict', 'max:255'],
        ];
        if (! $this->isPrecognitive()) {
            $rules['attachments'] = ['nullable', 'array', 'max:'.config('support.max_attachments')];
            $rules['attachments.*'] = ['bail', 'file', 'max:'.config('support.max_file_kib'), new SupportAttachmentType];
        }

        return $rules;
    }

    protected function prepareForValidation(): void
    {
        $normalized = [];
        foreach (['subject', 'description', 'email'] as $field) {
            $value = $this->input($field);
            if (is_string($value)) {
                $normalized[$field] = match ($field) {
                    'subject' => trim($value, " \t"),
                    'email' => Str::lower(trim($value)),
                    default => trim($value),
                };
            }
        }
        $this->merge($normalized);
    }

    public function messages(): array
    {
        return [
            'subject.required' => __('Enter a subject.'),
            'subject.string' => __('Enter a valid subject.'),
            'subject.max' => __('The subject must not exceed 200 characters.'),
            'subject.not_regex' => __('The subject must not contain line breaks.'),
            'description.required' => __('Enter a description.'),
            'description.string' => __('Enter a valid description.'),
            'description.max' => __('The description must not exceed 10000 characters.'),
            'email.required' => __('Enter your email address.'),
            'email.string' => __('Enter a valid email address.'),
            'email.email' => __('Enter a valid email address.'),
            'email.max' => __('The email address must not exceed 255 characters.'),
            'attachments.array' => __('Choose valid attachments.'),
            'attachments.max' => __('You can attach up to 3 files.'),
            'attachments.*.file' => __('The attachment could not be uploaded.'),
            'attachments.*.uploaded' => __('The attachment could not be uploaded.'),
            'attachments.*.max' => __('Each attachment must not exceed 5 MB.'),
        ];
    }
}
