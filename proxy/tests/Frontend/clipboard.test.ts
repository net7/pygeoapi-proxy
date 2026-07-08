import { describe, expect, test } from 'bun:test';

import { copyTextToClipboard } from '../../resources/js/lib/clipboard';

function fakeDocument(commandResult = true) {
    const calls: string[] = [];
    const textarea = {
        value: '',
        style: {} as Record<string, string>,
        setAttribute(name: string, value: string) {
            calls.push(`attribute:${name}:${value}`);
        },
        select() {
            calls.push('select');
        },
        setSelectionRange(start: number, end: number) {
            calls.push(`range:${start}:${end}`);
        },
    };

    return {
        calls,
        textarea,
        document: {
            body: {
                appendChild(node: unknown) {
                    expect(node).toBe(textarea);
                    calls.push('append');
                },
                removeChild(node: unknown) {
                    expect(node).toBe(textarea);
                    calls.push('remove');
                },
            },
            createElement(tagName: string) {
                expect(tagName).toBe('textarea');
                calls.push('create');

                return textarea;
            },
            execCommand(command: string) {
                calls.push(command);

                return commandResult;
            },
        },
    };
}

describe('copyTextToClipboard', () => {
    test('uses the async clipboard API when available', async () => {
        const writes: string[] = [];

        await expect(
            copyTextToClipboard('payload', {
                navigator: {
                    clipboard: {
                        async writeText(text: string) {
                            writes.push(text);
                        },
                    },
                },
            }),
        ).resolves.toBe(true);

        expect(writes).toEqual(['payload']);
    });

    test('uses the textarea fallback when async clipboard is unavailable', async () => {
        const fake = fakeDocument();

        await expect(
            copyTextToClipboard('payload', {
                document: fake.document,
            }),
        ).resolves.toBe(true);

        expect(fake.textarea.value).toBe('payload');
        expect(fake.calls).toEqual([
            'create',
            'attribute:readonly:',
            'append',
            'select',
            'range:0:7',
            'copy',
            'remove',
        ]);
    });

    test('falls back when async clipboard rejects', async () => {
        const fake = fakeDocument();

        await expect(
            copyTextToClipboard('payload', {
                document: fake.document,
                navigator: {
                    clipboard: {
                        async writeText() {
                            throw new Error('blocked');
                        },
                    },
                },
                warn() {
                    return undefined;
                },
            }),
        ).resolves.toBe(true);

        expect(fake.calls).toContain('copy');
    });

    test('returns false when no clipboard path is available', async () => {
        await expect(
            copyTextToClipboard('payload', {
                warn() {
                    return undefined;
                },
            }),
        ).resolves.toBe(false);
    });
});
