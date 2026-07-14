type CsvPreviewRecord = Record<string, unknown>;

export type CsvPreviewTable = {
    headers: string[];
    rows: string[][];
    truncated: boolean;
    columnCount: number;
};

const maxLegacyRows = 20;

export function normalizeCsvPreview(data: unknown): CsvPreviewTable | null {
    if (isRecord(data)) {
        const headers = stringArray(data.headers);
        const rows = rowArray(data.rows);

        if (headers && rows) {
            return tableFromRecords(headers, rows, data.truncated === true);
        }
    }

    if (typeof data === 'string') {
        return normalizeCsvSource(data);
    }

    return null;
}

function normalizeCsvSource(source: string): CsvPreviewTable | null {
    const records = parseCsvRecords(source).filter((record) =>
        record.some((cell) => cell !== ''),
    );

    if (records.length === 0) {
        return null;
    }

    const [headers, ...rows] = records;
    const limitedRows = rows.slice(0, maxLegacyRows);

    return tableFromRecords(headers, limitedRows, rows.length > maxLegacyRows);
}

function parseCsvRecords(source: string): string[][] {
    const records: string[][] = [];
    let record: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (inQuotes) {
            if (character === '"') {
                if (source[index + 1] === '"') {
                    cell += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += character;
            }

            continue;
        }

        if (character === '"') {
            inQuotes = true;
            continue;
        }

        if (character === ',') {
            record.push(cell);
            cell = '';
            continue;
        }

        if (character === '\n') {
            record.push(cell);
            records.push(record);
            record = [];
            cell = '';
            continue;
        }

        if (character === '\r') {
            continue;
        }

        cell += character;
    }

    if (cell !== '' || record.length > 0) {
        record.push(cell);
        records.push(record);
    }

    return records;
}

function tableFromRecords(
    headers: string[],
    rows: string[][],
    truncated: boolean,
): CsvPreviewTable | null {
    const columnCount = Math.max(
        headers.length,
        ...rows.map((row) => row.length),
    );

    if (columnCount === 0) {
        return null;
    }

    return {
        headers: padRow(headers, columnCount),
        rows: rows.map((row) => padRow(row, columnCount)),
        truncated,
        columnCount,
    };
}

function padRow(row: string[], columnCount: number): string[] {
    return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
}

function stringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    return value.map((item) => String(item ?? ''));
}

function rowArray(value: unknown): string[][] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    return value
        .map((row) => (Array.isArray(row) ? stringArray(row) : null))
        .filter((row): row is string[] => row !== null);
}

function isRecord(value: unknown): value is CsvPreviewRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
