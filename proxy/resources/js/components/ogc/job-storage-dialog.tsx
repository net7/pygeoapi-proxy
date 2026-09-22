import { CircleAlertIcon, HardDriveIcon } from 'lucide-react';
import { useState } from 'react';

import { AdminBadgePopover } from '@/components/admin-badge';
import { JobStorageDatabaseNotice } from '@/components/ogc/job-storage-database-notice';
import JobStorageTree from '@/components/ogc/job-storage-tree';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobStorage } from '@/hooks/use-job-storage';
import { useTranslation } from '@/hooks/use-translation';
import { formatStorageBytes, jobStorageVersion } from '@/lib/job-storage';
import type { ProcessExecutionDetail } from '@/types';

type StorageExecution = Pick<
    ProcessExecutionDetail,
    | 'id'
    | 'displayName'
    | 'canViewStorage'
    | 'status'
    | 'resultCollection'
    | 'results'
>;

export function JobStorageButton({
    execution,
}: {
    execution: StorageExecution;
}) {
    return execution.canViewStorage ? (
        <JobStorageDialog key={execution.id} execution={execution} />
    ) : null;
}

function JobStorageDialog({ execution }: { execution: StorageExecution }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <div className="relative inline-flex w-full sm:w-auto">
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                    >
                        <HardDriveIcon data-icon="inline-start" />
                        {t('jobs.storage.title')}
                    </Button>
                </DialogTrigger>
                <AdminBadgePopover
                    compact
                    className="absolute -top-1.5 -right-1.5"
                    description={t('jobs.storage.adminDescription')}
                />
            </div>
            <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
                <DialogHeader className="shrink-0 pr-6 text-left">
                    <DialogTitle>{t('jobs.storage.title')}</DialogTitle>
                    <DialogDescription className="break-words">
                        {t('jobs.storage.description', {
                            name: execution.displayName,
                        })}
                    </DialogDescription>
                </DialogHeader>
                <JobStorageContents
                    executionId={execution.id}
                    version={jobStorageVersion(execution)}
                    active={open}
                    loadingRows={Math.min(
                        8,
                        Math.max(4, execution.results.length + 1),
                    )}
                />
            </DialogContent>
        </Dialog>
    );
}

function JobStorageContents({
    executionId,
    version,
    active,
    loadingRows,
}: {
    executionId: number;
    version: string;
    active: boolean;
    loadingRows: number;
}) {
    const { locale, t } = useTranslation();
    const state = useJobStorage(executionId, version, { enabled: active });
    const loading = state.status === 'loading';

    return (
        <>
            <div
                className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-3"
                aria-busy={loading}
            >
                {loading ? (
                    <div role="status" className="flex flex-col gap-4">
                        <span className="sr-only">
                            {t('jobs.storage.loading')}
                        </span>
                        <div className="flex items-end justify-between gap-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-sm text-muted-foreground">
                                    {t('jobs.storage.total')}
                                </span>
                                <Skeleton className="h-9 w-36" />
                            </div>
                            <Skeleton className="h-5 w-16" />
                        </div>
                        <div
                            className="shrink-0 rounded-md border p-2"
                            aria-hidden="true"
                        >
                            {Array.from({ length: loadingRows }, (_, index) => (
                                <div
                                    key={index}
                                    className="flex h-9 items-center gap-2 px-2"
                                >
                                    <Skeleton className="size-4 shrink-0" />
                                    <Skeleton
                                        className={
                                            index === 0
                                                ? 'h-4 w-36'
                                                : 'h-4 w-2/3'
                                        }
                                    />
                                    <Skeleton className="ml-auto h-3 w-14 shrink-0" />
                                </div>
                            ))}
                        </div>
                        <Skeleton className="h-4 w-48" />
                    </div>
                ) : state.status === 'error' ? (
                    <Alert variant="destructive">
                        <CircleAlertIcon />
                        <AlertTitle>{t('jobs.storage.errorTitle')}</AlertTitle>
                        <AlertDescription>
                            {t('jobs.storage.errorDescription')}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <div
                            className="flex flex-wrap items-end justify-between gap-3"
                            role="status"
                        >
                            <div className="flex flex-col gap-1">
                                <span className="text-sm text-muted-foreground">
                                    {t('jobs.storage.total')}
                                </span>
                                <span
                                    className="text-3xl font-semibold tabular-nums"
                                    title={`${state.data.totalSizeBytes.toLocaleString(locale)} B`}
                                >
                                    {formatStorageBytes(
                                        state.data.totalSizeBytes,
                                        locale,
                                    )}
                                </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {t('jobs.storage.fileCount', {
                                    count: state.data.fileCount.toLocaleString(
                                        locale,
                                    ),
                                })}
                            </span>
                        </div>
                        <JobStorageDatabaseNotice storage={state.data} />
                        {state.data.fileCount > 0 ? (
                            <div className="shrink-0 overflow-x-auto rounded-md border">
                                <JobStorageTree
                                    nodes={state.data.roots}
                                    locale={locale}
                                    label={t('jobs.storage.files')}
                                />
                            </div>
                        ) : state.data.databaseResultCount === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t('jobs.storage.empty')}
                            </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                            {t('jobs.storage.updatedAt', {
                                date: new Date(
                                    state.data.inspectedAt,
                                ).toLocaleString(locale),
                            })}
                        </p>
                    </>
                )}
            </div>
            <DialogFooter className="shrink-0">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        {t('common.close')}
                    </Button>
                </DialogClose>
            </DialogFooter>
        </>
    );
}
