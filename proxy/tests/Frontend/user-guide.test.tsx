import { describe, expect, spyOn, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import * as dialog from '../../resources/js/components/ui/dialog';
import { UserGuide } from '../../resources/js/components/user-guide';

function renderGuideContent(isAdmin: boolean) {
    // The dialog portal has no DOM target during server rendering.
    const content = spyOn(dialog, 'DialogContent').mockImplementation(
        ({ children }) => <>{children}</>,
    );

    try {
        return renderToStaticMarkup(
            <UserGuide
                user={{
                    id: 1,
                    name: 'Ada Lovelace',
                    is_admin: isAdmin,
                    first_access_completed_at: null,
                }}
            />,
        );
    } finally {
        content.mockRestore();
    }
}

describe('user guide', () => {
    test('opens automatically for an incomplete first access', () => {
        const html = renderToStaticMarkup(
            <UserGuide
                user={{
                    id: 1,
                    name: 'Ada Lovelace',
                    is_admin: false,
                    first_access_completed_at: null,
                }}
            />,
        );

        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('aria-label="Help: open user guide"');
    });

    test('keeps Help available without reopening after first access', () => {
        const html = renderToStaticMarkup(
            <UserGuide
                user={{
                    id: 1,
                    name: 'Ada Lovelace',
                    is_admin: false,
                    first_access_completed_at: '2026-09-16T12:00:00.000000Z',
                }}
            />,
        );

        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).toContain('Help');
    });

    test('includes the user and administration chapters for admins', () => {
        const html = renderGuideContent(true);

        expect(html).toContain('Choose a process');
        expect(html).toContain('Explore the results');
        expect(html).toContain('Manage users');
        expect(html).toContain('Social sign-in');
        expect(html).toContain('Manage accounts');
        expect(html).toContain('Supervise jobs');
        expect(html).toContain('Diagnostics and cleanup');
        expect(html).toContain('Step 1 of 9');
    });

    test('keeps administration chapters out of the regular user guide', () => {
        const html = renderGuideContent(false);

        expect(html).toContain('Choose a process');
        expect(html).toContain('Explore the results');
        expect(html).not.toContain('Manage users');
        expect(html).not.toContain('Social sign-in');
        expect(html).not.toContain('Manage accounts');
        expect(html).not.toContain('Supervise jobs');
        expect(html).not.toContain('Diagnostics and cleanup');
        expect(html).toContain('Step 1 of 4');
    });
});
