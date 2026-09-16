import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { UserGuide } from '../../resources/js/components/user-guide';

describe('user guide', () => {
    test('opens automatically for an incomplete first access', () => {
        const html = renderToStaticMarkup(
            <UserGuide
                user={{
                    id: 1,
                    name: 'Ada Lovelace',
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
                    first_access_completed_at: '2026-09-16T12:00:00.000000Z',
                }}
            />,
        );

        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).toContain('Help');
    });
});
