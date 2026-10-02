<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;
use ZipArchive;

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
            'doc' => ['application/msword', 'application/x-ole-storage', 'application/CDFV2', 'application/vnd.ms-office'],
            'xls' => ['application/vnd.ms-excel', 'application/x-ole-storage', 'application/CDFV2', 'application/vnd.ms-office'],
            'ppt' => ['application/vnd.ms-powerpoint', 'application/x-ole-storage', 'application/CDFV2', 'application/vnd.ms-office'],
            'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/x-zip-compressed'],
            'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/x-zip-compressed'],
            'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed'],
            'txt', 'log', 'csv', 'json' => ['text/plain', 'text/csv', 'application/csv', 'application/json', 'text/json', 'application/x-empty', 'inode/x-empty'],
            default => [],
        };
        if (! $value instanceof UploadedFile || ! $value->isValid()
            || ! in_array($extension, config('support.extensions'), true)
            || ! in_array($value->getMimeType(), $mimes, true)
            || (in_array($extension, ['docx', 'xlsx', 'pptx'], true) && ! $this->hasOfficeParts($value, $extension))) {
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

    private function hasOfficeParts(UploadedFile $file, string $extension): bool
    {
        $mainPart = match ($extension) {
            'docx' => 'word/document.xml',
            'xlsx' => 'xl/workbook.xml',
            'pptx' => 'ppt/presentation.xml',
        };
        $archive = new ZipArchive;
        if ($archive->open($file->getPathname(), ZipArchive::RDONLY) !== true) {
            return false;
        }

        try {
            return $archive->locateName('[Content_Types].xml') !== false
                && $archive->locateName('_rels/.rels') !== false
                && $archive->locateName($mainPart) !== false;
        } finally {
            $archive->close();
        }
    }
}
