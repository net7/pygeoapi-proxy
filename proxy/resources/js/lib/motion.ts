import { startTransition } from 'react';

type NavigationOptions = {
    method?: string;
    only?: string[];
    async?: boolean;
    prefetch?: boolean;
};

const listeners = new Set<() => void>();
let activeNavigation: Pick<ViewTransition, 'finished'> | null = null;
let pendingNavigation: Promise<void> | null = null;

export function createNavigationReveal() {
    let revealed = false;

    return {
        getSnapshot: () => (revealed ? null : pendingNavigation),
        markRevealed: () => {
            revealed = true;
        },
    };
}

export function motionEnabled(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        activeNavigation === null
    );
}

export function subscribeToMotion(listener: () => void): () => void {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    listeners.add(listener);
    preference.addEventListener('change', listener);

    return () => {
        listeners.delete(listener);
        preference.removeEventListener('change', listener);
    };
}

export function captureNavigationTransition(
    transition: Pick<ViewTransition, 'finished'>,
): void {
    activeNavigation = transition;

    const finish = () => {
        // A skipped transition can finish after a newer navigation has started.
        if (activeNavigation !== transition) {
            return;
        }

        activeNavigation = null;
        pendingNavigation = null;
        delete document.documentElement.dataset.navigationTransition;
        listeners.forEach((listener) => listener());
    };

    pendingNavigation = transition.finished.then(finish, finish);
    document.documentElement.dataset.navigationTransition = 'capture';
    listeners.forEach((listener) => listener());
}

export function revealNavigationTransition(url: string): void {
    if (!activeNavigation) {
        return;
    }

    const current = new URL(window.location.href);
    const committed = new URL(url, current);

    // An older commit must not release a newer navigation's capture.
    if (
        committed.origin !== current.origin ||
        committed.pathname !== current.pathname ||
        committed.search !== current.search
    ) {
        return;
    }

    document.documentElement.dataset.navigationTransition = 'reveal';
}

export function navigationMotionOptions(
    href: string,
    options: NavigationOptions,
): { viewTransition: false | typeof captureNavigationTransition } {
    // Navigation may interrupt another navigation; local React animations may not.
    const supportsMotion =
        typeof window !== 'undefined' &&
        typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (
        !supportsMotion ||
        document.visibilityState === 'hidden' ||
        (options.method && options.method !== 'get') ||
        options.only?.length ||
        options.async ||
        options.prefetch
    ) {
        return { viewTransition: false };
    }

    const current = new URL(window.location.href);
    const next = new URL(href, current);
    const changesPage =
        next.origin === current.origin &&
        (next.pathname !== current.pathname || next.search !== current.search);

    return {
        viewTransition: changesPage ? captureNavigationTransition : false,
    };
}

export function runUiTransition(update: () => void): void {
    if (motionEnabled()) {
        startTransition(update);
    } else {
        update();
    }
}
