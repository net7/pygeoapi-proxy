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
                    'w-fit gap-2 border px-2.5 py-1 text-xs font-medium shadow-sm',
                    active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
                )}
                role="status"
            >
                <span
                    aria-hidden="true"
                    className="relative flex size-2.5 shrink-0"
                >
                    {active ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    ) : null}
                    <span
                        className={cn(
                            'relative inline-flex size-2.5',
                            active
                                ? 'rounded-full bg-emerald-500'
                                : 'rounded-full bg-slate-400',
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
