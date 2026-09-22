import { usePage } from '@inertiajs/react';
import { HardDriveIcon } from 'lucide-react';

import { AdminBadgePopover } from '@/components/admin-badge';
import { JobStorageDatabaseNotice } from '@/components/ogc/job-storage-database-notice';
import { Spinner } from '@/components/ui/spinner';
import { useJobStorage } from '@/hooks/use-job-storage';
import { useTranslation } from '@/hooks/use-translation';
import { formatStorageBytes, jobStorageVersion } from '@/lib/job-storage';
import type { ProcessExecutionListItem } from '@/types';

export function JobDeletionStorage({
    execution,
}: {
    execution: ProcessExecutionListItem;
}) {
    const { auth } = usePage().props;

    return auth.user?.is_admin ? (
        <JobDeletionStorageDetails key={execution.id} execution={execution} />
    ) : null;
}

function JobDeletionStorageDetails({
    execution,
}: {
    execution: ProcessExecutionListItem;
}) {
    const { locale, t } = useTranslation();
    const state = useJobStorage(execution.id, jobStorageVersion(execution), {
        refreshInterval: 5_000,
    });

    return (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                    <HardDriveIcon
                        className="size-4 text-primary"
                        aria-hidden="true"
                    />
                    {t('jobs.storage.reclaimTitle')}
                </h3>
                <AdminBadgePopover />
            </div>
            <div
                role="status"
                aria-live="polite"
                className="flex flex-col gap-1"
            >
                {state.status === 'loading' ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner />
                        {t('jobs.storage.loading')}
                    </p>
                ) : state.status === 'error' ? (
                    <p className="text-sm text-muted-foreground">
                        {t('jobs.storage.reclaimUnavailable')}
                    </p>
                ) : (
                    <>
                        <p className="text-2xl font-semibold tabular-nums">
                            {formatStorageBytes(
                                state.data.totalSizeBytes,
                                locale,
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {t('jobs.storage.reclaimDescription')}
                        </p>
                        <JobStorageDatabaseNotice storage={state.data} />
                    </>
                )}
            </div>
        </div>
    );
}
