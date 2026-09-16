import { describe, expect, test } from 'bun:test';

import {
    createTableSettingsStore,
    hasCustomTableSettings,
    TableSettingsRegistry,
} from '../../resources/js/lib/table-settings';
import type {
    TableSettings,
    TableSettingsRequest,
} from '../../resources/js/lib/table-settings';

const defaults: TableSettings = {
    columnVisibility: { message: false },
    sorting: [{ id: 'createdAt', desc: true }],
    pageSize: 10,
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });

    return { promise, resolve, reject };
}

function server() {
    let settings = structuredClone(defaults);
    const requests: TableSettingsRequest[] = [];
    const responses: ReturnType<typeof deferred<void>>[] = [];

    return {
        requests,
        responses,
        get settings() {
            return settings;
        },
        async send(request: TableSettingsRequest) {
            requests.push(request);
            const response = deferred<void>();
            responses.push(response);
            await response.promise;
            settings =
                request.method === 'delete'
                    ? structuredClone(defaults)
                    : {
                          ...settings,
                          ...request.data,
                          columnVisibility: {
                              ...settings.columnVisibility,
                              ...request.data?.columnVisibility,
                          },
                      };

            return structuredClone(settings);
        },
    };
}

async function tick() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('persistent table settings', () => {
    test('reset is available only when the effective preferences differ from defaults', () => {
        expect(hasCustomTableSettings(defaults, defaults)).toBe(false);
        expect(
            hasCustomTableSettings(
                {
                    ...defaults,
                    columnVisibility: {
                        ...defaults.columnVisibility,
                        progress: true,
                    },
                },
                defaults,
            ),
        ).toBe(false);
        expect(
            hasCustomTableSettings({ ...defaults, pageSize: 20 }, defaults),
        ).toBe(true);
        expect(
            hasCustomTableSettings({ ...defaults, sorting: [] }, defaults),
        ).toBe(true);
        expect(
            hasCustomTableSettings(
                {
                    ...defaults,
                    sorting: [{ id: 'createdAt', desc: false }],
                },
                defaults,
            ),
        ).toBe(true);
        expect(
            hasCustomTableSettings(
                {
                    ...defaults,
                    columnVisibility: { message: true },
                },
                defaults,
            ),
        ).toBe(true);
        expect(
            hasCustomTableSettings(
                {
                    ...defaults,
                    columnVisibility: { message: false, progress: false },
                },
                defaults,
            ),
        ).toBe(true);
    });

    test('accepts fresh server settings without letting history or concurrent edits overwrite them', async () => {
        const backend = server();
        const store = createTableSettingsStore(defaults, backend.send);
        store.update({ pageSize: 50 });
        await tick();
        const pendingRevision = store.getRevision();
        store.reconcile(defaults, pendingRevision);
        expect(store.getSnapshot().settings.pageSize).toBe(50);
        backend.responses[0].resolve();
        await store.flush();

        const revision = store.getRevision();
        store.reconcile({ ...defaults, pageSize: 20 }, revision);
        expect(store.getSnapshot().settings.pageSize).toBe(20);
        store.reconcile(defaults);
        expect(store.getSnapshot().settings.pageSize).toBe(20);

        store.update({ pageSize: 50 });
        await tick();
        backend.responses[1].resolve();
        await store.flush();
        store.reconcile(defaults, revision);
        expect(store.getSnapshot().settings.pageSize).toBe(50);
    });

    test('a requested reset still runs when the in-flight save fails', async () => {
        const backend = server();
        const store = createTableSettingsStore(defaults, backend.send);
        store.update({ pageSize: 50 });
        await tick();
        store.reset();
        backend.responses[0].reject(new Error('save failed'));
        await tick();
        expect(backend.requests[1]?.method).toBe('delete');
        backend.responses[1].resolve();
        await store.flush();
        expect(store.getSnapshot().settings).toEqual(defaults);
        expect(store.getSnapshot().error).toBeNull();
    });

    test('hydration never writes, and incoming pages cannot erase an unsaved change', async () => {
        const backend = server();
        const store = createTableSettingsStore(defaults, backend.send);
        store.reconcile({ ...defaults, pageSize: 20 });
        await tick();
        expect(backend.requests).toHaveLength(0);
        expect(store.getSnapshot().settings.pageSize).toBe(20);

        store.update({ pageSize: 50 });
        store.reconcile(defaults);
        expect(store.getSnapshot().settings.pageSize).toBe(50);
        await tick();
        backend.responses[0].resolve();
        await store.flush();
        store.reconcile(defaults);
        expect(store.getSnapshot().settings.pageSize).toBe(50);
    });

    test('serializes rapid changes and coalesces queued patches without dropping columns', async () => {
        const backend = server();
        const store = createTableSettingsStore(defaults, backend.send);
        store.update({ columnVisibility: { message: true } });
        await tick();
        store.update({ pageSize: 20 });
        store.update({ pageSize: 50, columnVisibility: { progress: false } });
        store.update({ sorting: [{ id: 'status', desc: false }] });
        expect(backend.requests).toHaveLength(1);

        backend.responses[0].resolve();
        await tick();
        expect(backend.requests).toHaveLength(2);
        expect(store.getSnapshot().settings.pageSize).toBe(50);
        backend.responses[1].resolve();
        await store.flush();

        expect(backend.settings).toEqual({
            columnVisibility: { message: true, progress: false },
            sorting: [{ id: 'status', desc: false }],
            pageSize: 50,
        });
        expect(store.getSnapshot().settings).toEqual(backend.settings);
    });

    test('keeps failed changes available for retry and blocks dependent navigation until saved', async () => {
        const backend = server();
        const store = createTableSettingsStore(defaults, backend.send);
        store.update({ pageSize: 20 });
        await tick();
        backend.responses[0].reject(new Error('offline'));
        await expect(store.flush()).rejects.toThrow('offline');
        expect(store.getSnapshot().settings.pageSize).toBe(20);
        expect(store.getSnapshot().error).toBeInstanceOf(Error);

        const retried = store.retry();
        await tick();
        backend.responses[1].resolve();
        await retried;
        expect(store.getSnapshot().error).toBeNull();
        expect(backend.settings.pageSize).toBe(20);
    });

    test('reset supersedes unsent preferences, then applies changes made during reset', async () => {
        const backend = server();
        const store = createTableSettingsStore(defaults, backend.send);
        store.update({ pageSize: 20 });
        await tick();
        store.update({ sorting: [{ id: 'status', desc: false }] });
        store.reset();
        store.update({ columnVisibility: { message: true } });
        backend.responses[0].resolve();
        await tick();
        expect(backend.requests[1].method).toBe('delete');
        backend.responses[1].resolve();
        await tick();
        backend.responses[2].resolve();
        await store.flush();

        expect(backend.settings).toEqual({
            ...defaults,
            columnVisibility: { message: true },
        });
        expect(store.getSnapshot().settings).toEqual(backend.settings);
    });

    test('pending saves survive subscribers leaving but cannot cross an account change', async () => {
        const backend = server();
        const registry = new TableSettingsRegistry();
        const first = registry.get(1, 'jobs', defaults, backend.send);
        const unsubscribe = first.subscribe(() => {});
        first.update({ pageSize: 20 });
        unsubscribe();
        await tick();
        first.update({ pageSize: 50 });
        expect(registry.get(1, 'jobs', defaults, backend.send)).toBe(first);

        const second = registry.get(2, 'jobs', defaults, backend.send);
        backend.responses[0].resolve();
        await tick();

        expect(backend.requests).toHaveLength(1);
        expect(second.getSnapshot().settings).toEqual(defaults);
        expect(backend.requests[0].signal.aborted).toBe(true);
    });
});
