import { ShieldCheckIcon } from 'lucide-react';
import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type AdminBadgeProps = {
    compact?: boolean;
    className?: string;
};

export function AdminBadge({ compact = false, className }: AdminBadgeProps) {
    const { t } = useTranslation();

    return (
        <Badge
            variant="outline"
            data-slot="admin-badge"
            className={cn(
                'h-5 gap-1 rounded-full border-primary/15 bg-(--play-sky) px-2 py-0 text-[11px] leading-none font-medium text-(--play-sky-ink)',
                compact && 'size-5 p-0',
                className,
            )}
        >
            <ShieldCheckIcon className="size-3" aria-hidden="true" />
            <span className={compact ? 'sr-only' : undefined}>
                {t('common.adminOnly')}
            </span>
        </Badge>
    );
}

export function AdminBadgePopover({
    compact,
    className,
    description,
}: AdminBadgeProps & { description?: string }) {
    const { t } = useTranslation();
    const titleId = useId();
    const descriptionId = useId();

    return (
        <Popover>
            <PopoverTrigger
                type="button"
                className={cn(
                    'group inline-flex w-fit shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    className,
                )}
            >
                <AdminBadge
                    compact={compact}
                    className="group-hover:bg-accent group-data-[state=open]:bg-accent"
                />
            </PopoverTrigger>
            <PopoverContent
                align="end"
                side="top"
                collisionPadding={16}
                className="max-w-[calc(100vw-2rem)]"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <PopoverHeader>
                    <PopoverTitle id={titleId}>
                        {t('common.adminOnly')}
                    </PopoverTitle>
                    <PopoverDescription id={descriptionId}>
                        {description ?? t('common.adminOnlyDescription')}
                    </PopoverDescription>
                </PopoverHeader>
            </PopoverContent>
        </Popover>
    );
}
