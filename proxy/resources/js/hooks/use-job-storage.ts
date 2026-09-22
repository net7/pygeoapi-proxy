import { useEffect, useState } from 'react';

import { storage } from '@/routes/jobs';
import type { JobStorage } from '@/types';

export type JobStorageState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; data: JobStorage };

export function useJobStorage(
    executionId: number,
    version: string,
    {
        enabled = true,
        refreshInterval = 0,
    }: { enabled?: boolean; refreshInterval?: number } = {},
): JobStorageState {
    const [state, setState] = useState<JobStorageState>({ status: 'loading' });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;

        async function load() {
            try {
                const response = await fetch(storage.url(executionId), {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Unable to inspect job storage.');
                }

                const data: JobStorage = await response.json();

                if (!controller.signal.aborted) {
                    setState({ status: 'ready', data });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setState({ status: 'error' });
                }
            } finally {
                if (refreshInterval > 0 && !controller.signal.aborted) {
                    timeout = setTimeout(load, refreshInterval);
                }
            }
        }

        void load();

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [executionId, version, enabled, refreshInterval]);

    return state;
}
