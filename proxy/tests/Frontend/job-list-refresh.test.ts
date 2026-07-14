import { describe, expect, test } from 'bun:test';

import {
    consumeAdminJobsIndexStale,
    consumeJobsIndexStale,
    markJobsIndexStale,
} from '../../resources/js/lib/job-list-refresh';

function fakeStorage(): Storage {
    const values = new Map<string, string>();

    return {
        get length() {
            return values.size;
        },
        clear() {
            values.clear();
        },
        getItem(key: string) {
            return values.get(key) ?? null;
        },
        key(index: number) {
            return Array.from(values.keys())[index] ?? null;
        },
        removeItem(key: string) {
            values.delete(key);
        },
        setItem(key: string, value: string) {
            values.set(key, value);
        },
    };
}

describe('job list refresh marker', () => {
    test('marks user and admin jobs indexes stale independently', () => {
        const storage = fakeStorage();

        markJobsIndexStale(storage);

        expect(consumeJobsIndexStale(storage)).toBe(true);
        expect(consumeJobsIndexStale(storage)).toBe(false);
        expect(consumeAdminJobsIndexStale(storage)).toBe(true);
        expect(consumeAdminJobsIndexStale(storage)).toBe(false);
    });

    test('ignores unavailable storage', () => {
        expect(() => markJobsIndexStale(null)).not.toThrow();
        expect(consumeJobsIndexStale(null)).toBe(false);
        expect(consumeAdminJobsIndexStale(null)).toBe(false);
    });
});
