import { router } from '@inertiajs/react';
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { destroy } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type DeleteJobOwner = {
    name: string;
    email: string;
    avatar?: string | null;
};

type DeleteJobButtonProps = {
    execution: ProcessExecutionListItem;
    owner?: DeleteJobOwner;
    redirectBack?: boolean;
    showLabel?: boolean;
    className?: string;
};

export function DeleteJobButton({
    execution,
    owner,
    redirectBack = false,
    showLabel = true,
    className,
}: DeleteJobButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const action = destroy(
        execution.id,
        redirectBack ? { query: { redirect: 'back' } } : undefined,
    ).url;

    function submit(): void {
        setProcessing(true);

        router.delete(action, {
            preserveScroll: redirectBack,
            onSuccess: () => setOpen(false),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <>
            <Button
                type="button"
                variant="destructive"
                size={showLabel ? 'sm' : 'icon'}
                className={className}
                aria-label={t('jobs.delete')}
                title={t('jobs.delete')}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                <Trash2Icon data-icon={showLabel ? 'inline-start' : 'icon'} />
                {showLabel ? (
                    t('jobs.delete')
                ) : (
                    <span className="sr-only">{t('jobs.delete')}</span>
                )}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="overflow-hidden p-0 sm:max-w-xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader className="px-6 pt-6 pr-12 text-left">
                        <DialogTitle>{t('jobs.deleteTitle')}</DialogTitle>
                        <DialogDescription className="text-sm break-words">
                            {t('jobs.deleteDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100">
                        <div className="flex items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200">
                                <AlertTriangleIcon
                                    data-icon="dialog-status"
                                    className="size-5"
                                />
                            </span>
                            <div className="min-w-0 flex-1">
                                <DeleteJobSummary
                                    execution={execution}
                                    owner={owner}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing}
                            >
                                {t('common.cancel')}
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={submit}
                            disabled={processing}
                        >
                            {processing ? (
                                <Spinner data-icon="inline-start" />
                            ) : (
                                <Trash2Icon data-icon="inline-start" />
                            )}
                            {t('jobs.deleteConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteJobSummary({
    execution,
    owner,
}: {
    execution: ProcessExecutionListItem;
    owner?: DeleteJobOwner;
}) {
    const { t } = useTranslation();
    const showRemoteJobId = Boolean(execution.remoteJobId);

    return (
        <table className="table w-full table-fixed overflow-hidden rounded-md border border-current/15 bg-white/65 text-sm dark:bg-black/10">
            <tbody>
                <tr
                    className={cn(
                        'table-row',
                        (showRemoteJobId || owner) &&
                            'border-b border-current/10',
                    )}
                >
                    <th
                        scope="row"
                        className="table-cell w-32 px-3 py-2 text-left align-middle text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        {t('jobs.localJobId')}
                    </th>
                    <td className="table-cell px-3 py-2 align-middle font-mono font-semibold break-all">
                        #{execution.id}
                    </td>
                </tr>
                {showRemoteJobId ? (
                    <tr
                        className={cn(
                            'table-row',
                            owner && 'border-b border-current/10',
                        )}
                    >
                        <th
                            scope="row"
                            className="table-cell w-32 px-3 py-2 text-left align-middle text-xs font-medium tracking-wide text-muted-foreground uppercase"
                        >
                            {t('jobs.remoteJobId')}
                        </th>
                        <td className="table-cell px-3 py-2 align-middle font-mono font-semibold break-all">
                            {execution.remoteJobId}
                        </td>
                    </tr>
                ) : null}
                {owner ? (
                    <tr className="table-row">
                        <th
                            scope="row"
                            className="table-cell w-32 px-3 py-2 text-left align-middle text-xs font-medium tracking-wide text-muted-foreground uppercase"
                        >
                            {t('common.user')}
                        </th>
                        <td className="table-cell min-w-0 px-3 py-2 align-middle">
                            <DeleteJobOwnerIdentity owner={owner} />
                        </td>
                    </tr>
                ) : null}
            </tbody>
        </table>
    );
}

function DeleteJobOwnerIdentity({ owner }: { owner: DeleteJobOwner }) {
    const getInitials = useInitials();

    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 rounded-full">
                <AvatarImage src={owner.avatar ?? undefined} alt={owner.name} />
                <AvatarFallback className="rounded-full bg-white/80 text-xs font-medium text-red-900 dark:bg-red-950/50 dark:text-red-100">
                    {getInitials(owner.name)}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{owner.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {owner.email}
                </span>
            </div>
        </div>
    );
}
