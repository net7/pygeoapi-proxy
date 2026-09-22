import { usePoll } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type JobPollingIndicatorProps = {
    active: boolean;
    activeLabel: string;
    interval: number;
    inactiveLabel: string;
    only: string[];
    paused?: boolean;
};

export default function JobPollingIndicator({
    active,
    activeLabel,
    interval,
    inactiveLabel,
    only,
    paused = false,
}: JobPollingIndicatorProps) {
    const label = active ? activeLabel : inactiveLabel;

    return (
        <>
            {active && !paused ? (
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
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                    ) : null}
                    <span
                        className={cn(
                            'relative inline-flex size-2.5',
                            active
                                ? 'rounded-full bg-success'
                                : 'rounded-full bg-muted-foreground',
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
    const cancel = useRef<(() => void) | undefined>(undefined);

    useEffect(() => () => cancel.current?.(), []);

    usePoll(
        interval,
        {
            only,
            onCancelToken: (token) => {
                cancel.current = token.cancel;
            },
            onFinish: () => {
                cancel.current = undefined;
            },
        },
        {
            mode: 'rest',
        },
    );

    return null;
}
