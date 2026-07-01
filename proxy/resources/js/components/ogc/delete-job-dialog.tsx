import { router } from '@inertiajs/react';
import { AlertTriangleIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

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
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { destroy } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type DeleteJobButtonProps = {
    execution: ProcessExecutionListItem;
    redirectBack?: boolean;
    className?: string;
};

export function DeleteJobButton({
    execution,
    redirectBack = false,
    className,
}: DeleteJobButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const processLabel = execution.processTitle ?? execution.processId;
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
                size="sm"
                className={className}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                <Trash2Icon data-icon="inline-start" />
                {t('jobs.delete')}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="overflow-hidden p-0 sm:max-w-md"
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader className="px-6 pt-6 pr-12 text-left">
                        <DialogTitle>{t('jobs.deleteTitle')}</DialogTitle>
                        <DialogDescription className="space-y-0.5 break-words">
                            <span className="block font-semibold text-foreground">
                                {processLabel}
                            </span>
                            <span className="block font-mono text-xs text-muted-foreground italic">
                                {execution.processId}
                            </span>
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
                            <div className="min-w-0 space-y-2">
                                <p className="text-sm">
                                    {t('jobs.deleteDescription')}
                                </p>
                                <dl className="grid gap-1 rounded-md border border-current/15 bg-white/55 px-3 py-2 text-sm dark:bg-black/10">
                                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                                        <dt className="text-muted-foreground">
                                            {t('jobs.localJobId')}
                                        </dt>
                                        <dd className="font-mono font-semibold break-all">
                                            #{execution.id}
                                        </dd>
                                    </div>
                                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                                        <dt className="text-muted-foreground">
                                            {t('jobs.remoteJobId')}
                                        </dt>
                                        <dd
                                            className={cn(
                                                'font-mono font-semibold break-all',
                                                !execution.remoteJobId &&
                                                    'font-sans text-muted-foreground',
                                            )}
                                        >
                                            {execution.remoteJobId ??
                                                t('common.notAvailable')}
                                        </dd>
                                    </div>
                                </dl>
                                <p className="text-xs opacity-80">
                                    {t('jobs.deleteRemoteNote')}
                                </p>
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
