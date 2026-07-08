<?php

namespace App\Services\Ogc;

class CsvPreviewBuilder
{
    public const int MaxBytes = 50000;

    public const int MaxDataRows = 20;

    /**
     * @return array{headers: array<int, string>, rows: array<int, array<int, string>>, truncated: bool, source: string}
     */
    public function fromString(string $csv): array
    {
        $source = substr($csv, 0, self::MaxBytes);
        $truncated = strlen($csv) > self::MaxBytes;
        $records = $this->records($source, self::MaxDataRows + 2, $truncated);

        if ($records === []) {
            return [
                'headers' => [],
                'rows' => [],
                'truncated' => $truncated,
                'source' => $source,
            ];
        }

        $headers = array_shift($records) ?? [];

        if (count($records) > self::MaxDataRows) {
            $truncated = true;
        }

        return [
            'headers' => $headers,
            'rows' => array_slice($records, 0, self::MaxDataRows),
            'truncated' => $truncated,
            'source' => $source,
        ];
    }

    /**
     * @return array<int, array<int, string>>
     */
    private function records(string $source, int $limit, bool &$truncated): array
    {
        $handle = fopen('php://temp', 'r+');

        if ($handle === false) {
            return [];
        }

        fwrite($handle, $source);
        rewind($handle);

        $records = [];

        try {
            while (($record = fgetcsv($handle, escape: '')) !== false) {
                if ($record === [null]) {
                    continue;
                }

                $normalized = array_map(
                    fn (mixed $cell): string => $cell === null ? '' : (string) $cell,
                    $record,
                );

                if ($this->isEmptyRecord($normalized)) {
                    continue;
                }

                if (count($records) >= $limit) {
                    $truncated = true;
                    break;
                }

                $records[] = $normalized;
            }
        } finally {
            fclose($handle);
        }

        return $records;
    }

    /**
     * @param  array<int, string>  $record
     */
    private function isEmptyRecord(array $record): bool
    {
        foreach ($record as $cell) {
            if ($cell !== '') {
                return false;
            }
        }

        return true;
    }
}
