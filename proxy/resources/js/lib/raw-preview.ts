import { normalizeCsvPreview } from '@/lib/csv-preview';

export type RawPreviewKind = 'csv' | 'json' | 'text';

export function copyableRawText(data: unknown, kind?: RawPreviewKind): string {
    if (typeof data === 'string') {
        return data;
    }

    if (kind === 'text') {
        return String(data ?? '');
    }

    if (kind === 'csv') {
        const csv = csvPreviewText(data);

        if (csv) {
            return csv;
        }
    }

    try {
        return JSON.stringify(data, null, 2) ?? String(data ?? '');
    } catch {
        return String(data ?? '');
    }
}

export function jsonPreviewValue(data: unknown): object | null {
    const value = typeof data === 'string' ? parseJson(data) : data;

    return typeof value === 'object' && value !== null ? value : null;
}

function parseJson(data: string): unknown {
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

function csvPreviewText(data: unknown): string | null {
    const preview = normalizeCsvPreview(data);

    if (!preview) {
        return null;
    }

    return [preview.headers, ...preview.rows]
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\n');
}

function escapeCsvCell(cell: string): string {
    if (!/[",\n\r]/.test(cell)) {
        return cell;
    }

    return `"${cell.replaceAll('"', '""')}"`;
}
