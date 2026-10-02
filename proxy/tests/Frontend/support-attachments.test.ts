import { expect, test } from 'bun:test';
import { selectSupportAttachments } from '../../resources/js/lib/support-attachments';

const limits = {
    maxAttachments: 3,
    maxFileBytes: 5242880,
    allowedExtensions: ['log', 'txt'],
};

test('a rejected batch preserves the current attachments', () => {
    const current = ['a.log', 'b.log', 'c.log'].map(
        (name) => new File(['trace'], name),
    );
    expect(
        selectSupportAttachments(
            current,
            [new File(['trace'], 'd.log')],
            limits,
        ),
    ).toEqual({ ok: false, reason: 'count' });
    expect(current.map((file) => file.name)).toEqual([
        'a.log',
        'b.log',
        'c.log',
    ]);
});

test('the exact byte limit is accepted but one extra byte is rejected', () => {
    expect(
        selectSupportAttachments(
            [],
            [new File([new Uint8Array(5242880)], 'trace.LOG')],
            limits,
        ).ok,
    ).toBe(true);
    expect(
        selectSupportAttachments(
            [],
            [new File([new Uint8Array(5242881)], 'trace.log')],
            limits,
        ),
    ).toEqual({ ok: false, reason: 'size', fileName: 'trace.log' });
});

test.each(['archive.zip', 'fake.log.exe', 'log'])(
    'unsupported extension %s is rejected',
    (name) => {
        expect(
            selectSupportAttachments([], [new File(['data'], name)], limits),
        ).toEqual({ ok: false, reason: 'extension', fileName: name });
    },
);

test('removing an attachment allows its replacement including the same filename', () => {
    const current = ['a.log', 'b.log', 'c.log'].map(
        (name) => new File(['trace'], name),
    );
    const replacement = new File(['new trace'], 'b.log');
    const result = selectSupportAttachments(
        current.filter((_, i) => i !== 1),
        [replacement],
        limits,
    );
    expect(result).toEqual({
        ok: true,
        files: [current[0], current[2], replacement],
    });
});
