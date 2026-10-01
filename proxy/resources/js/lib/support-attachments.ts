import type { SupportLimits } from '@/types/support';

type Selection =
    | { ok: true; files: File[] }
    | { ok: false; reason: 'count' | 'size' | 'extension'; fileName?: string };

export function formatSupportAttachmentSize(bytes: number, locale: string) {
    const unit = bytes >= 1024 ** 2 ? 2 : bytes >= 1024 ? 1 : 0;
    const amount = (bytes / 1024 ** unit).toLocaleString(locale, {
        maximumFractionDigits: 1,
    });

    return `${amount} ${['B', 'KB', 'MB'][unit]}`;
}

export function selectSupportAttachments(
    current: File[],
    incoming: File[],
    limits: SupportLimits,
): Selection {
    const files = [...current, ...incoming];

    if (files.length > limits.maxAttachments) {
        return { ok: false, reason: 'count' };
    }

    for (const file of files) {
        if (file.size > limits.maxFileBytes) {
            return { ok: false, reason: 'size', fileName: file.name };
        }

        const dot = file.name.lastIndexOf('.');
        const extension =
            dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';

        if (!limits.allowedExtensions.includes(extension)) {
            return { ok: false, reason: 'extension', fileName: file.name };
        }
    }

    return { ok: true, files };
}
