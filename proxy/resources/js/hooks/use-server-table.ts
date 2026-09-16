import { router } from '@inertiajs/react';
import type {
    ColumnFiltersState,
    PaginationState,
    RowSelectionState,
    SortingState,
    Updater,
    VisibilityState,
} from '@tanstack/react-table';
import { useEffect, useRef, useState } from 'react';

import { useTableSettings } from '@/hooks/use-table-settings';
import { hasCustomTableSettings } from '@/lib/table-settings';
import type { TableSettings } from '@/lib/table-settings';
import type { TableKey } from '@/lib/table-settings-client';

export type TablePagination = {
    current_page: number;
    per_page: number;
    last_page: number;
    total: number;
};
type Options = {
    key: TableKey;
    url: string;
    settings: TableSettings;
    defaults: TableSettings;
    pagination: TablePagination;
    filters: ColumnFiltersState;
    query: (filters: ColumnFiltersState) => Record<string, string | number>;
    hiddenColumns: VisibilityState;
};

function updateValue<T>(updater: Updater<T>, previous: T): T {
    return typeof updater === 'function'
        ? (updater as (old: T) => T)(previous)
        : updater;
}

export function useServerTable(options: Options) {
    const preferences = useTableSettings(options.key, options.settings);
    const [draftFilters, setFilters] = useState(options.filters);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const columnFilters = busy ? draftFilters : options.filters;
    const filtersRef = useRef(options.filters);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const sequence = useRef(0);
    const mounted = useRef(true);
    const restoreAttempt = useRef<string | null>(null);
    const serverFilters = JSON.stringify(options.filters);
    const querySettings = JSON.stringify({
        sorting: preferences.settings.sorting,
        pageSize: preferences.settings.pageSize,
    });
    const serverQuerySettings = JSON.stringify({
        sorting: options.settings.sorting,
        pageSize: options.settings.pageSize,
    });
    const perPage = options.pagination.per_page;
    const stale =
        querySettings !== serverQuerySettings ||
        preferences.settings.pageSize !== perPage;
    const { store, saving, error } = preferences;

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            sequence.current += 1;
            restoreAttempt.current = null;
            clearTimeout(timer.current);
        };
    }, []);

    useEffect(() => {
        if (!busy) {
            const filters = JSON.parse(serverFilters) as ColumnFiltersState;
            filtersRef.current = filters;
        }
    }, [serverFilters, busy]);

    useEffect(() => {
        if (!stale) {
            restoreAttempt.current = null;

            return;
        }

        if (busy || saving || error || loadError) {
            return;
        }

        const attempt = `${serverQuerySettings}:${querySettings}:${perPage}`;

        if (restoreAttempt.current === attempt) {
            return;
        }

        restoreAttempt.current = attempt;
        const current = ++sequence.current;

        // History may restore rows fetched before the latest preferences were saved.
        void store
            .flush()
            .then(() => {
                if (!mounted.current || current !== sequence.current) {
                    return;
                }

                const revision = store.getRevision();
                let succeeded = false;
                router.reload({
                    onStart: () => {
                        setFilters(filtersRef.current);
                        setLoadError(false);
                        setBusy(true);
                    },
                    onSuccess: (page) => {
                        succeeded = true;

                        if (mounted.current && current === sequence.current) {
                            store.reconcile(
                                page.props.tableSettings as TableSettings,
                                revision,
                            );
                            setRowSelection({});
                        }
                    },
                    onFinish: () => {
                        if (mounted.current && current === sequence.current) {
                            setBusy(false);
                            setLoadError(!succeeded);
                        }
                    },
                });
            })
            .catch(() => {});
    }, [
        stale,
        busy,
        saving,
        error,
        loadError,
        store,
        serverQuerySettings,
        querySettings,
        perPage,
    ]);

    function visit(page: number, debounce = false) {
        clearTimeout(timer.current);
        const current = ++sequence.current;
        setFilters(filtersRef.current);
        setLoadError(false);
        setBusy(true);
        const send = async () => {
            try {
                await preferences.store.flush();

                if (!mounted.current || current !== sequence.current) {
                    return;
                }

                const revision = preferences.store.getRevision();
                let succeeded = false;
                router.get(
                    options.url,
                    { ...options.query(filtersRef.current), page },
                    {
                        preserveState: true,
                        preserveScroll: true,
                        replace: true,
                        onSuccess: (page) => {
                            succeeded = true;

                            if (current === sequence.current) {
                                preferences.store.reconcile(
                                    page.props.tableSettings as TableSettings,
                                    revision,
                                );
                                setRowSelection({});
                            }
                        },
                        onFinish: () => {
                            if (
                                mounted.current &&
                                current === sequence.current
                            ) {
                                setBusy(false);
                                setLoadError(!succeeded);
                            }
                        },
                    },
                );
            } catch {
                if (mounted.current && current === sequence.current) {
                    setBusy(false);
                }
            }
        };

        if (debounce) {
            timer.current = setTimeout(() => void send(), 300);
        } else {
            void send();
        }
    }

    function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
        const previous = filtersRef.current;
        const filters = updateValue(updater, previous);
        filtersRef.current = filters;
        setFilters(filters);
        const search = (value: ColumnFiltersState) =>
            value.find((filter) =>
                ['jobSearch', 'userSearch'].includes(filter.id),
            )?.value;
        visit(1, search(filters) !== search(previous));
    }

    function onColumnVisibilityChange(updater: Updater<VisibilityState>) {
        const previous =
            preferences.store.getSnapshot().settings.columnVisibility;
        const next = updateValue(updater, {
            ...previous,
            ...options.hiddenColumns,
        });
        const changed = Object.fromEntries(
            Object.entries(next).filter(
                ([key, value]) =>
                    !(key in options.hiddenColumns) && value !== previous[key],
            ),
        );

        if (Object.keys(changed).length) {
            preferences.store.update({ columnVisibility: changed });
        }
    }

    function onSortingChange(updater: Updater<SortingState>) {
        const sorting = updateValue(
            updater,
            preferences.store.getSnapshot().settings.sorting,
        );
        preferences.store.update({ sorting });
        visit(1);
    }

    function onPaginationChange(updater: Updater<PaginationState>) {
        const previous = {
            pageIndex: options.pagination.current_page - 1,
            pageSize: preferences.store.getSnapshot().settings.pageSize,
        };
        const next = updateValue(updater, previous);

        if (next.pageSize !== previous.pageSize) {
            preferences.store.update({ pageSize: next.pageSize });
            visit(1);
        } else if (next.pageIndex !== previous.pageIndex) {
            visit(next.pageIndex + 1);
        }
    }

    function resetSettings() {
        preferences.store.reset();
        visit(1);
    }

    function retrySettings() {
        void preferences.store
            .retry()
            .then(() => visit(1))
            .catch(() => {});
    }

    return {
        busy: busy || stale,
        saving: preferences.saving,
        canReset: hasCustomTableSettings(
            preferences.settings,
            options.defaults,
        ),
        error: preferences.error || loadError,
        loadError: !preferences.error && loadError,
        resetSettings,
        retrySettings,
        resetFilters: () => onColumnFiltersChange([]),
        tableOptions: {
            manualPagination: true,
            manualSorting: true,
            manualFiltering: true,
            autoResetPageIndex: false,
            pageCount: options.pagination.last_page,
            onColumnFiltersChange,
            onColumnVisibilityChange,
            onSortingChange,
            onPaginationChange,
            onRowSelectionChange: setRowSelection,
            state: {
                columnFilters,
                columnVisibility: {
                    ...preferences.settings.columnVisibility,
                    ...options.hiddenColumns,
                },
                sorting: preferences.settings.sorting,
                pagination: {
                    pageIndex: options.pagination.current_page - 1,
                    pageSize: preferences.settings.pageSize,
                },
                rowSelection,
            },
        },
    };
}
