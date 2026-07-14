// Credit: https://usehooks-ts.com/
import { useState } from 'react';

import { copyTextToClipboard } from '@/lib/clipboard';

export type CopiedValue = string | null;
export type CopyFn = (text: string) => Promise<boolean>;
export type UseClipboardReturn = [CopiedValue, CopyFn];

export function useClipboard(): UseClipboardReturn {
    const [copiedText, setCopiedText] = useState<CopiedValue>(null);

    const copy: CopyFn = async (text) => {
        if (await copyTextToClipboard(text)) {
            setCopiedText(text);

            return true;
        }

        setCopiedText(null);

        return false;
    };

    return [copiedText, copy];
}
