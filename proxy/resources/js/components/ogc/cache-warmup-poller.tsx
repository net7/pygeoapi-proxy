import { usePoll } from '@inertiajs/react';

type CacheWarmupPollerProps = {
    interval: number;
    only: string[];
};

export default function CacheWarmupPoller({
    interval,
    only,
}: CacheWarmupPollerProps) {
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
