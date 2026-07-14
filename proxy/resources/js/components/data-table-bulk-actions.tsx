import type { LucideIcon } from 'lucide-react';
import { CheckSquareIcon, ChevronDownIcon, XIcon } from 'lucide-react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';

export type BulkActionPayload = {
    ids: number[];
};

export type DataTableBulkAction = {
    id: string;
    label: string;
    title: string;
    description: string;
    confirmLabel: string;
    icon: LucideIcon;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
};

export function DataTableBulkActions({
    actions,
    onClearSelection,
    processing,
    selectedCount,
    selectionLabel,
}: {
    actions: DataTableBulkAction[];
    onClearSelection: () => void;
    processing: boolean;
    selectedCount: number;
    selectionLabel: string;
}) {
    const { t } = useTranslation();
    const [pendingAction, setPendingAction] =
        useState<DataTableBulkAction | null>(null);

    if (selectedCount === 0) {
        return null;
    }

    const PendingIcon = pendingAction?.icon;
    const confirmVariant =
        pendingAction?.variant === 'destructive' ? 'destructive' : 'default';

    return (
        <>
            <div className="flex flex-col gap-3 rounded-md border bg-card px-3 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <CheckSquareIcon className="size-4" aria-hidden />
                    </span>
                    <p className="min-w-0 truncate text-sm font-medium">
                        {selectionLabel}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={processing}
                            >
                                {t('common.chooseAction')}
                                <ChevronDownIcon data-icon="inline-end" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuGroup>
                                {actions.map((action) => {
                                    const ActionIcon = action.icon;

                                    return (
                                        <DropdownMenuItem
                                            key={action.id}
                                            variant={
                                                action.variant === 'destructive'
                                                    ? 'destructive'
                                                    : undefined
                                            }
                                            onSelect={() =>
                                                setPendingAction(action)
                                            }
                                        >
                                            <ActionIcon data-icon="inline-start" />
                                            {action.label}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        disabled={processing}
                    >
                        <XIcon data-icon="inline-start" />
                        {t('common.clearSelection')}
                    </Button>
                </div>
            </div>

            <Dialog
                open={pendingAction !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingAction(null);
                    }
                }}
            >
                <DialogContent className="overflow-hidden p-0 sm:max-w-md">
                    <DialogHeader className="px-6 pt-6 pr-12 text-left">
                        <DialogTitle>{pendingAction?.title}</DialogTitle>
                        <DialogDescription>
                            {pendingAction?.description}
                        </DialogDescription>
                    </DialogHeader>

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
                            variant={confirmVariant}
                            onClick={() => pendingAction?.onConfirm()}
                            disabled={processing}
                        >
                            {processing ? (
                                <Spinner data-icon="inline-start" />
                            ) : PendingIcon ? (
                                <PendingIcon data-icon="inline-start" />
                            ) : null}
                            {pendingAction?.confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
