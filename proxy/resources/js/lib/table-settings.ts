import type { SortingState, VisibilityState } from '@tanstack/react-table';

export type TableSettings = {
    columnVisibility: VisibilityState;
    sorting: SortingState;
    pageSize: number;
};

export type TableSettingsRequest = {
    method: 'patch' | 'delete';
    data?: Partial<TableSettings>;
    signal: AbortSignal;
};

type Transport = (request: TableSettingsRequest) => Promise<TableSettings>;

type Operation = Omit<TableSettingsRequest, 'signal'>;
type Snapshot = { settings: TableSettings; saving: boolean; error: unknown };

export function hasCustomTableSettings(
    settings: TableSettings,
    defaults: TableSettings,
): boolean {
    const columns = new Set([
        ...Object.keys(defaults.columnVisibility),
        ...Object.keys(settings.columnVisibility),
    ]);

    return (
        settings.pageSize !== defaults.pageSize ||
        settings.sorting.length !== defaults.sorting.length ||
        settings.sorting.some(
            (sort, index) =>
                sort.id !== defaults.sorting[index]?.id ||
                sort.desc !== defaults.sorting[index]?.desc,
        ) ||
        [...columns].some(
            (column) =>
                (settings.columnVisibility[column] ?? true) !==
                (defaults.columnVisibility[column] ?? true),
        )
    );
}

function mergeSettings(
    settings: TableSettings,
    patch: Partial<TableSettings>,
): TableSettings {
    return {
        ...settings,
        ...patch,
        columnVisibility: {
            ...settings.columnVisibility,
            ...patch.columnVisibility,
        },
    };
}

export function createTableSettingsStore(
    initial: TableSettings,
    send: Transport,
) {
    let snapshot: Snapshot = { settings: initial, saving: false, error: null };
    let pending: Operation[] = [];
    let running: Promise<void> | undefined;
    let locallyEdited = false;
    let revision = 0;
    const listeners = new Set<() => void>();
    const controller = new AbortController();

    function publish(next: Snapshot) {
        snapshot = next;
        listeners.forEach((listener) => listener());
    }

    function start() {
        if (
            running ||
            snapshot.error ||
            controller.signal.aborted ||
            !pending.length
        ) {
            return;
        }

        publish({ ...snapshot, saving: true });
        running = Promise.resolve()
            .then(async () => {
                while (pending.length && !controller.signal.aborted) {
                    const operation = pending.shift()!;

                    try {
                        const saved = await send({
                            ...operation,
                            signal: controller.signal,
                        });

                        if (controller.signal.aborted) {
                            return;
                        }

                        const settings = pending.reduce(
                            (value, queued) =>
                                mergeSettings(value, queued.data ?? {}),
                            saved,
                        );
                        publish({ settings, saving: true, error: null });
                    } catch (error) {
                        if (controller.signal.aborted) {
                            return;
                        }

                        // A newer reset replaces failed and unsent edits alike.
                        if (
                            pending.some((queued) => queued.method === 'delete')
                        ) {
                            continue;
                        }

                        pending.unshift(operation);
                        publish({ ...snapshot, error });
                        break;
                    }
                }
            })
            .finally(() => {
                running = undefined;
                publish({ ...snapshot, saving: false });
            });
    }

    async function flush() {
        do {
            start();
            await running;
        } while (
            !snapshot.error &&
            !controller.signal.aborted &&
            pending.length
        );

        if (controller.signal.aborted) {
            throw new Error('Table settings session ended');
        }

        if (snapshot.error) {
            throw snapshot.error;
        }
    }

    return {
        getSnapshot: () => snapshot,
        getRevision: () => revision,
        subscribe(listener: () => void) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        reconcile(settings: TableSettings, expectedRevision?: number) {
            // History and polling can contain props captured before our last write.
            if (
                !controller.signal.aborted &&
                !running &&
                !pending.length &&
                !snapshot.error &&
                (!locallyEdited || expectedRevision === revision) &&
                (expectedRevision === undefined ||
                    expectedRevision === revision) &&
                JSON.stringify(settings) !== JSON.stringify(snapshot.settings)
            ) {
                publish({ ...snapshot, settings });
            }
        },
        update(patch: Partial<TableSettings>) {
            if (controller.signal.aborted) {
                return;
            }

            locallyEdited = true;
            revision += 1;
            const last = pending.at(-1);

            if (last?.method === 'patch') {
                last.data = {
                    ...last.data,
                    ...patch,
                    ...(last.data?.columnVisibility || patch.columnVisibility
                        ? {
                              columnVisibility: {
                                  ...last.data?.columnVisibility,
                                  ...patch.columnVisibility,
                              },
                          }
                        : {}),
                };
            } else {
                pending.push({ method: 'patch', data: patch });
            }

            publish({
                ...snapshot,
                settings: mergeSettings(snapshot.settings, patch),
            });
            start();
        },
        reset() {
            if (controller.signal.aborted) {
                return;
            }

            locallyEdited = true;
            revision += 1;
            pending = [{ method: 'delete' }];
            publish({ ...snapshot, error: null });
            start();
        },
        flush,
        retry() {
            publish({ ...snapshot, error: null });

            return flush();
        },
        cancel() {
            pending = [];
            controller.abort();
        },
    };
}

export type TableSettingsStore = ReturnType<typeof createTableSettingsStore>;

export class TableSettingsRegistry {
    private userId: number | null = null;
    private stores = new Map<string, TableSettingsStore>();

    activate(userId: number | null) {
        if (this.userId === userId) {
            return;
        }

        this.stores.forEach((store) => store.cancel());
        this.stores.clear();
        this.userId = userId;
    }

    get(
        userId: number,
        table: string,
        initial: TableSettings,
        send: Transport,
    ) {
        this.activate(userId);
        let store = this.stores.get(table);

        if (!store) {
            store = createTableSettingsStore(initial, send);
            this.stores.set(table, store);
        }

        return store;
    }
}
