import type { SupportLimits } from '@/types/support';

type Selection =
    | { ok: true; files: File[] }
    | { ok: false; reason: 'count' | 'size' | 'extension'; fileName?: string };

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
