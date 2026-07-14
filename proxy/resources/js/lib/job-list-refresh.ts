const jobsIndexStaleKey = 'pygeoapi-proxy:jobs-index-stale';
const adminJobsIndexStaleKey = 'pygeoapi-proxy:admin-jobs-index-stale';

export function markJobsIndexStale(
    storage: Storage | null = browserSessionStorage(),
): void {
    markStorageKey(jobsIndexStaleKey, storage);
    markStorageKey(adminJobsIndexStaleKey, storage);
}

export function consumeJobsIndexStale(
    storage: Storage | null = browserSessionStorage(),
): boolean {
    return consumeStorageKey(jobsIndexStaleKey, storage);
}

export function consumeAdminJobsIndexStale(
    storage: Storage | null = browserSessionStorage(),
): boolean {
    return consumeStorageKey(adminJobsIndexStaleKey, storage);
}

function markStorageKey(key: string, storage: Storage | null): void {
    try {
        storage?.setItem(key, '1');
    } catch {
        // Private browsing or blocked storage should not break the form flow.
    }
}

function consumeStorageKey(key: string, storage: Storage | null): boolean {
    if (!storage) {
        return false;
    }

    try {
        const isStale = storage.getItem(key) === '1';

        if (isStale) {
            storage.removeItem(key);
        }

        return isStale;
    } catch {
        return false;
    }
}

function browserSessionStorage(): Storage | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.sessionStorage;
}
