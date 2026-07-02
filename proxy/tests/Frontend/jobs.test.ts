import { describe, expect, test } from 'bun:test';

import { formatJobDate } from '../../resources/js/lib/jobs';

describe('formatJobDate', () => {
    test('formats datetimes with numeric day month year and 24 hour time', () => {
        expect(formatJobDate('2020-01-01T10:00:00', 'en-US')).toBe(
            '01/01/2020 10:00',
        );
    });

    test('formats date-only values without a time', () => {
        expect(formatJobDate('2020-01-01', 'en-US')).toBe('01/01/2020');
    });

    test('uses the unavailable label for empty or invalid dates', () => {
        expect(formatJobDate(null, 'en-US', 'Non disponibile')).toBe(
            'Non disponibile',
        );
        expect(formatJobDate('not-a-date', 'en-US', 'Non disponibile')).toBe(
            'Non disponibile',
        );
    });
});
