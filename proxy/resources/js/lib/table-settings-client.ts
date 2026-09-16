import { http, router } from '@inertiajs/react';

import { update as updateAdminJobs } from '@/routes/settings/admin/tables/jobs';
import { update as updateAdminUsers } from '@/routes/settings/admin/tables/users';
import { update as updateJobs } from '@/routes/settings/tables/jobs';
import type { Auth } from '@/types';

import { TableSettingsRegistry } from './table-settings';
import type { TableSettings, TableSettingsRequest } from './table-settings';

export type TableKey = 'jobs' | 'admin.jobs' | 'admin.users';
const routes = {
    jobs: updateJobs,
    'admin.jobs': updateAdminJobs,
    'admin.users': updateAdminUsers,
};
export const tableSettingsRegistry = new TableSettingsRegistry();

export function initializeTableSettings() {
    return router.on('navigate', (event) => {
        const auth = event.detail.page.props.auth as Auth | undefined;
        tableSettingsRegistry.activate(auth?.user?.id ?? null);
    });
}

export async function sendTableSettings(
    table: TableKey,
    request: TableSettingsRequest,
): Promise<TableSettings> {
    const response = await http.getClient().request({
        url: routes[table].url(),
        ...request,
        headers: { Accept: 'application/json' },
    });
    const data = JSON.parse(response.data) as { settings: TableSettings };

    return {
        ...data.settings,
        columnVisibility: { ...data.settings.columnVisibility },
    };
}
