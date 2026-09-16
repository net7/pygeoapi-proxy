import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@/hooks/use-translation';
import { createTableSettingsStore } from '@/lib/table-settings';
import type { TableSettings } from '@/lib/table-settings';
import {
    sendTableSettings,
    tableSettingsRegistry,
} from '@/lib/table-settings-client';
import type { TableKey } from '@/lib/table-settings-client';
import type { Auth } from '@/types';

export function useTableSettings(table: TableKey, initial: TableSettings) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { t } = useTranslation();
    const userId = auth.user!.id;
    const store = useMemo(() => {
        const send = (request: Parameters<typeof sendTableSettings>[1]) =>
            sendTableSettings(table, request);

        return typeof window === 'undefined'
            ? createTableSettingsStore(initial, send)
            : tableSettingsRegistry.get(userId, table, initial, send);
        // The store remains stable across polling and Inertia visits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, table]);
    const snapshot = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getSnapshot,
    );

    useEffect(() => store.reconcile(initial), [store, initial]);
    useEffect(() => {
        if (snapshot.error) {
            toast.error(t('tables.settingsSaveError'), {
                id: `table-settings-${table}`,
            });
        }
    }, [snapshot.error, table, t]);

    return { ...snapshot, store };
}
