<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;

class SupportAttachmentType implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $extension = $value instanceof UploadedFile ? strtolower($value->getClientOriginalExtension()) : '';
        $mimes = match ($extension) {
            'png' => ['image/png'],
            'jpg', 'jpeg' => ['image/jpeg'],
            'webp' => ['image/webp'],
            'pdf' => ['application/pdf'],
            'txt', 'log', 'csv', 'json' => ['text/plain', 'text/csv', 'application/csv', 'application/json', 'text/json', 'application/x-empty', 'inode/x-empty'],
            default => [],
        };
        if (! $value instanceof UploadedFile || ! $value->isValid()
            || ! in_array($extension, config('support.extensions'), true)
            || ! in_array($value->getMimeType(), $mimes, true)) {
            $fail('The attachment type or content is not supported.')->translate();

            return;
        }
        if (in_array($extension, ['txt', 'log', 'csv', 'json'], true)) {
            $contents = file_get_contents($value->getRealPath());
            if ($contents === false || preg_match('/[\x00-\x08\x0b\x0e-\x1f\x7f]/', $contents)) {
                $fail('The attachment type or content is not supported.')->translate();
            }
        }
    }
}
