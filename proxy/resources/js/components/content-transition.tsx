import { usePage } from '@inertiajs/react';
import {
    use,
    useLayoutEffect,
    useState,
    useSyncExternalStore,
    ViewTransition,
} from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

import {
    createNavigationReveal,
    motionEnabled,
    revealNavigationTransition,
    subscribeToMotion,
} from '@/lib/motion';

const serverMotionEnabled = () => false;
const serverNavigation = () => null;

export function NavigationTransition({ children }: PropsWithChildren) {
    const page = usePage();

    // Inertia commits inside the native update callback. Release the new DOM
    // before its capture so links and scrolling remain interactive during the fade.
    useLayoutEffect(() => {
        revealNavigationTransition(page.url);
    }, [page]);

    return children;
}

export function AfterNavigation({ children }: PropsWithChildren) {
    const [reveal] = useState(createNavigationReveal);
    const pending = useSyncExternalStore(
        subscribeToMotion,
        reveal.getSnapshot,
        serverNavigation,
    );

    // Mark only committed content: suspended renders must keep waiting, while
    // an already visible preview must stay visible on subsequent navigation.
    useLayoutEffect(() => {
        reveal.markRevealed();
    }, [reveal]);

    if (pending) {
        use(pending);
    }

    return children;
}

export function ContentTransition({
    children,
    default: defaultTransition = 'content-change',
    enter,
    exit,
    update,
    share,
    ...props
}: ComponentProps<typeof ViewTransition>) {
    const enabled = useSyncExternalStore(
        subscribeToMotion,
        motionEnabled,
        serverMotionEnabled,
    );

    return (
        <ViewTransition
            {...props}
            default={enabled ? defaultTransition : 'none'}
            enter={enabled ? enter : 'none'}
            exit={enabled ? exit : 'none'}
            update={enabled ? update : 'none'}
            share={enabled ? share : 'none'}
        >
            {children}
        </ViewTransition>
    );
}
