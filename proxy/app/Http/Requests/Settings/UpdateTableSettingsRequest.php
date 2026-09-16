<?php

namespace App\Http\Requests\Settings;

use App\Enums\TableKey;
use App\Support\UserTableSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateTableSettingsRequest extends FormRequest
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
        $columns = TableKey::from($this->route('table'))->columns();

        return [
            'columnVisibility' => ['sometimes', 'array:'.implode(',', $columns)],
            'columnVisibility.*' => ['required', 'boolean:strict'],
            'sorting' => ['sometimes', 'array', 'list', 'max:'.count($columns)],
            'sorting.*' => ['required', 'array:id,desc'],
            'sorting.*.id' => ['required', 'string', 'distinct:strict', Rule::in($columns)],
            'sorting.*.desc' => ['required', 'boolean:strict'],
            'pageSize' => ['sometimes', 'integer:strict', Rule::in(UserTableSettings::PAGE_SIZES)],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['columnVisibility', 'sorting', 'pageSize']) as $key) {
                $validator->errors()->add($key, __('validation.prohibited', ['attribute' => $key]));
            }
        }];
    }
}
