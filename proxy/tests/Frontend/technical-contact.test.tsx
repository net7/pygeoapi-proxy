import * as inertia from '@inertiajs/react';
import { expect, spyOn, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TechnicalContactDialog } from '../../resources/js/components/admin/technical-contact-dialog';
import * as dialog from '../../resources/js/components/ui/dialog';

test.each([false, true])(
    'the appointment dialog names both contacts and reflects processing: %s',
    (processing) => {
        const content = spyOn(dialog, 'DialogContent').mockImplementation(
            ({ children }) => <>{children}</>,
        );
        const form = spyOn(inertia, 'useForm').mockReturnValue({
            processing,
            errors: { user: 'The candidate is no longer active.' },
            submit: () => {},
        } as unknown as ReturnType<typeof inertia.useForm>);

        try {
            const html = renderToStaticMarkup(
                <TechnicalContactDialog
                    candidate={{
                        id: 2,
                        name: 'New Contact',
                        email: 'new@example.org',
                    }}
                    currentContact={{
                        id: 1,
                        name: 'Old Contact',
                        email: 'old@example.org',
                    }}
                    open
                    onOpenChange={() => {}}
                />,
            );
            expect(html).toContain('New Contact');
            expect(html).toContain('new@example.org');
            expect(html).toContain('Old Contact');
            expect(html).toContain('old@example.org');
            expect(html).toContain('Cancel');
            expect(html).toContain('The candidate is no longer active.');
            const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
            expect(/ disabled(?:=|\s|>)/.test(submit ?? '')).toBe(processing);
        } finally {
            form.mockRestore();
            content.mockRestore();
        }
    },
);
