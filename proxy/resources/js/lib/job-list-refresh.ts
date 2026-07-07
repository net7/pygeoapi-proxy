const jobsIndexStaleKey = 'pygeoapi-proxy:jobs-index-stale';

export function markJobsIndexStale(
    storage: Storage | null = browserSessionStorage(),
): void {
    try {
        storage?.setItem(jobsIndexStaleKey, '1');
    } catch {
        // Private browsing or blocked storage should not break the form flow.
    }
}

export function consumeJobsIndexStale(
    storage: Storage | null = browserSessionStorage(),
): boolean {
    if (!storage) {
        return false;
    }

    try {
        const isStale = storage.getItem(jobsIndexStaleKey) === '1';

        if (isStale) {
            storage.removeItem(jobsIndexStaleKey);
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
