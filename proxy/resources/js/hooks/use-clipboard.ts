// Credit: https://usehooks-ts.com/
import { useState } from 'react';

export type CopiedValue = string | null;
export type CopyFn = (text: string) => Promise<boolean>;
export type UseClipboardReturn = [CopiedValue, CopyFn];

export function useClipboard(): UseClipboardReturn {
    const [copiedText, setCopiedText] = useState<CopiedValue>(null);

    const copy: CopyFn = async (text) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
                setCopiedText(text);

                return true;
            } catch (error) {
                console.warn('Async clipboard copy failed', error);
            }
        }

        try {
            writeClipboardFallback(text);
            setCopiedText(text);

            return true;
        } catch (error) {
            console.warn('Copy failed', error);
            setCopiedText(null);

            return false;
        }
    };

    return [copiedText, copy];
}

function writeClipboardFallback(text: string): void {
    if (typeof document === 'undefined' || !document.body) {
        throw new Error('Clipboard fallback is not available');
    }

    const textarea = document.createElement('textarea');

    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    try {
        if (!document.execCommand('copy')) {
            throw new Error('Clipboard copy command was rejected');
        }
    } finally {
        document.body.removeChild(textarea);
    }
}
