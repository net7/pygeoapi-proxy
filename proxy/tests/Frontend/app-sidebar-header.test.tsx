import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppSidebarHeader } from '../../resources/js/components/app-sidebar-header';
import { SidebarProvider } from '../../resources/js/components/ui/sidebar';

describe('app sidebar header', () => {
    test('exposes a compact language dropdown with English selected when the sidebar is collapsed', () => {
        const html = renderToStaticMarkup(
            <SidebarProvider defaultOpen={false}>
                <AppSidebarHeader
                    breadcrumbs={[{ title: 'My Jobs', href: '/jobs' }]}
                />
            </SidebarProvider>,
        );
        const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1];
        const languageButton = header?.match(
            /<button\b(?=[^>]*aria-label="Language: English")[^>]*>[\s\S]*?<\/button>/,
        )?.[0];

        expect(header).toContain('My Jobs');
        expect(languageButton).toBeDefined();
        expect(languageButton).toContain('aria-haspopup="menu"');
        expect(languageButton).toContain('aria-expanded="false"');
        expect(languageButton).toContain('<span aria-hidden="true">🇬🇧</span>');
        expect(languageButton).toContain('>EN</span>');
        expect(header).not.toContain('role="radiogroup"');
    });
});
