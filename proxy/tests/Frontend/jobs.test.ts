import { describe, expect, test } from 'bun:test';

import {
    formatJobDate,
    isJobFailure,
    isResultCollectionActive,
} from '../../resources/js/lib/jobs';

describe('isJobFailure', () => {
    test('classifies terminal failure statuses', () => {
        expect(
            ['failed', 'submission_failed', 'remote_missing'].map(isJobFailure),
        ).toEqual([true, true, true]);
        expect(
            ['successful', 'submitting', 'accepted', 'running'].map(
                isJobFailure,
            ),
        ).toEqual([false, false, false, false]);
    });
});

describe('isResultCollectionActive', () => {
    test('keeps refreshing only while results are pending or collecting', () => {
        expect(
            ['pending', 'collecting', 'successful', 'failed', null].map(
                isResultCollectionActive,
            ),
        ).toEqual([true, true, false, false, false]);
    });
});

describe('formatJobDate', () => {
    test('formats datetimes with numeric day month year and 24 hour time', () => {
        expect(formatJobDate('2020-01-01T10:00:00', 'en-US')).toBe(
            '01/01/2020 10:00',
        );
    });

    test('formats date-only values without a time', () => {
        expect(formatJobDate('2020-01-01', 'en-US')).toBe('01/01/2020');
    });

    test('uses the requested locale date order', () => {
        expect(formatJobDate('2020-03-04T10:05:00', 'en-US')).toBe(
            '03/04/2020 10:05',
        );
        expect(formatJobDate('2020-03-04T10:05:00', 'it-IT')).toBe(
            '04/03/2020 10:05',
        );
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
