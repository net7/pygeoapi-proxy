import { describe, expect, test } from 'bun:test';

import { formatPageTitle } from '../../resources/js/lib/page-title';

describe('formatPageTitle', () => {
    test('prefixes page titles with the app name', () => {
        expect(formatPageTitle('Dashboard', 'Pygeoapi Proxy')).toBe(
            'Pygeoapi Proxy | Dashboard',
        );
    });

    test('uses only the app name when no page title is provided', () => {
        expect(formatPageTitle('', 'Pygeoapi Proxy')).toBe('Pygeoapi Proxy');
    });
});
