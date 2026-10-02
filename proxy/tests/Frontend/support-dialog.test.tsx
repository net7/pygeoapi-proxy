import { expect, spyOn, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupportDialog } from '../../resources/js/components/support-dialog';
import * as popover from '../../resources/js/components/ui/popover';

const support = {
    allowGuests: false,
    available: true,
    isTechnicalContact: false,
    maxAttachments: 3,
    maxFileBytes: 5242880,
    allowedExtensions: ['log', 'pdf'],
};

test('support is a labeled icon button opening a dialog instead of navigating', () => {
    const html = renderToStaticMarkup(
        <SupportDialog initialEmail="user@example.org" support={support} />,
    );
    expect(html).toContain('Support');
    expect(html).toContain('<svg');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('href=');
});

test('the technical contact gets a disabled button and a keyboard reachable explanation', () => {
    const content = spyOn(popover, 'PopoverContent').mockImplementation(
        ({ children }) => <>{children}</>,
    );

    try {
        const html = renderToStaticMarkup(
            <SupportDialog
                initialEmail="contact@example.org"
                support={{ ...support, isTechnicalContact: true }}
            />,
        );
        expect(html).toMatch(/<button[^>]*disabled=""/);
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('Why Support is disabled');
        expect(html).toContain('You are the technical contact');
        expect(html).toContain('cannot send a request to yourself');
        expect(html).not.toContain('<form');
    } finally {
        content.mockRestore();
    }
});
