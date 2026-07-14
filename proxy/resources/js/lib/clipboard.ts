type ClipboardNavigator = {
    clipboard?: {
        writeText: (text: string) => Promise<void>;
    };
};

type ClipboardTextArea = {
    value: string;
    style: Record<string, string> | CSSStyleDeclaration;
    setAttribute: (name: string, value: string) => void;
    select: () => void;
    setSelectionRange: (start: number, end: number) => void;
};

type ClipboardDocument = {
    body?: {
        appendChild: (node: ClipboardTextArea) => void;
        removeChild: (node: ClipboardTextArea) => void;
    };
    createElement: (tagName: 'textarea') => ClipboardTextArea;
    execCommand: (command: 'copy') => boolean;
};

type ClipboardEnvironment = {
    document?: ClipboardDocument;
    navigator?: ClipboardNavigator;
    warn?: (message: string, error: unknown) => void;
};

export async function copyTextToClipboard(
    text: string,
    environment: ClipboardEnvironment = {},
): Promise<boolean> {
    const clipboardNavigator =
        environment.navigator ??
        (typeof navigator !== 'undefined' ? navigator : undefined);
    const clipboardDocument = (environment.document ??
        (typeof document !== 'undefined' ? document : undefined)) as
        ClipboardDocument | undefined;
    const warn = environment.warn ?? console.warn;

    if (clipboardNavigator?.clipboard) {
        try {
            await clipboardNavigator.clipboard.writeText(text);

            return true;
        } catch (error) {
            warn('Async clipboard copy failed', error);
        }
    }

    try {
        writeClipboardFallback(text, clipboardDocument);

        return true;
    } catch (error) {
        warn('Copy failed', error);

        return false;
    }
}

function writeClipboardFallback(
    text: string,
    clipboardDocument?: ClipboardDocument,
): void {
    if (!clipboardDocument?.body) {
        throw new Error('Clipboard fallback is not available');
    }

    const textarea = clipboardDocument.createElement('textarea');

    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';

    clipboardDocument.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    try {
        if (!clipboardDocument.execCommand('copy')) {
            throw new Error('Clipboard copy command was rejected');
        }
    } finally {
        clipboardDocument.body.removeChild(textarea);
    }
}
