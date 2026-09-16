import { usePoll } from '@inertiajs/react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type JobPollingIndicatorProps = {
    active: boolean;
    activeLabel: string;
    interval: number;
    inactiveLabel: string;
    only: string[];
};

export default function JobPollingIndicator({
    active,
    activeLabel,
    interval,
    inactiveLabel,
    only,
}: JobPollingIndicatorProps) {
    const label = active ? activeLabel : inactiveLabel;

    return (
        <>
            {active ? (
                <ActiveJobPoller interval={interval} only={only} />
            ) : null}
            <Badge
                variant="secondary"
                className={cn(
                    'w-fit gap-2 border px-2.5 py-1 text-xs font-medium',
                    active
                        ? 'border-success/25 bg-success/10 text-success-emphasis'
                        : 'border-border bg-card text-muted-foreground',
                )}
                role="status"
            >
                <span
                    aria-hidden="true"
                    className="relative flex size-2.5 shrink-0"
                >
                    {active ? (
                        <span className="absolute inline-flex size-full animate-ping rounded-none bg-success opacity-75" />
                    ) : null}
                    <span
                        className={cn(
                            'relative inline-flex size-2.5',
                            active
                                ? 'rounded-none bg-success'
                                : 'rounded-none bg-muted-foreground',
                        )}
                    />
                </span>
                <span>{label}</span>
            </Badge>
        </>
    );
}

function ActiveJobPoller({
    interval,
    only,
}: Pick<JobPollingIndicatorProps, 'interval' | 'only'>) {
    usePoll(
        interval,
        {
            only,
        },
        {
            mode: 'rest',
        },
    );

    return null;
}
