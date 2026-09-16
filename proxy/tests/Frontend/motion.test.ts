import { afterEach, describe, expect, test } from 'bun:test';

import {
    captureNavigationTransition,
    createNavigationReveal,
    motionEnabled,
    navigationMotionOptions,
    revealNavigationTransition,
} from '../../resources/js/lib/motion';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
});

function browser({
    reducedMotion = false,
    supported = true,
    hidden = false,
} = {}) {
    globalThis.window = {
        location: { href: 'http://localhost/jobs' },
        matchMedia: () => ({ matches: reducedMotion }),
    } as unknown as Window & typeof globalThis;
    globalThis.document = {
        visibilityState: hidden ? 'hidden' : 'visible',
        documentElement: { dataset: {} },
        ...(supported ? { startViewTransition: () => {} } : {}),
    } as unknown as Document;
}

describe('navigation motion', () => {
    test('animates a normal navigation and pagination to a different URL', () => {
        browser();
        expect(navigationMotionOptions('/processes', {}).viewTransition).toBe(
            captureNavigationTransition,
        );
        expect(navigationMotionOptions('/jobs?page=2', {}).viewTransition).toBe(
            captureNavigationTransition,
        );
    });

    test.each([
        ['/jobs', {}],
        ['/jobs#results', {}],
        ['/processes', { only: ['processes'] }],
        ['/processes', { async: true }],
        ['/processes', { prefetch: true }],
        ['/processes', { method: 'post' }],
        ['https://another.example/processes', {}],
    ])(
        'keeps reloads, background work and form submissions immediate: %s %j',
        (href, options) => {
            browser();
            expect(navigationMotionOptions(href, options).viewTransition).toBe(
                false,
            );
        },
    );

    test('respects reduced motion and unsupported browsers', () => {
        for (const options of [{ reducedMotion: true }, { supported: false }]) {
            browser(options);
            expect(motionEnabled()).toBe(false);
            expect(
                navigationMotionOptions('/processes', {}).viewTransition,
            ).toBe(false);
        }
    });

    test('is safe during server rendering', () => {
        expect(motionEnabled()).toBe(false);
        expect(navigationMotionOptions('/processes', {}).viewTransition).toBe(
            false,
        );
    });

    test('does not start an animation in a hidden tab', () => {
        browser({ hidden: true });
        expect(navigationMotionOptions('/processes', {}).viewTransition).toBe(
            false,
        );
    });

    test('releases the new page after commit while its outgoing snapshot fades', async () => {
        browser();
        const transition = Promise.withResolvers<void>();
        captureNavigationTransition({ finished: transition.promise });
        expect(document.documentElement.dataset.navigationTransition).toBe(
            'capture',
        );

        revealNavigationTransition('/jobs');
        expect(document.documentElement.dataset.navigationTransition).toBe(
            'reveal',
        );
        expect(motionEnabled()).toBe(false);
        expect(navigationMotionOptions('/processes', {}).viewTransition).toBe(
            captureNavigationTransition,
        );

        transition.resolve();
        await transition.promise;
        expect(
            document.documentElement.dataset.navigationTransition,
        ).toBeUndefined();
        expect(motionEnabled()).toBe(true);
    });

    test('ignores an older page commit while a newer destination is pending', async () => {
        browser();
        const transition = Promise.withResolvers<void>();
        captureNavigationTransition({ finished: transition.promise });

        revealNavigationTransition('/processes');
        expect(document.documentElement.dataset.navigationTransition).toBe(
            'capture',
        );

        revealNavigationTransition('/jobs');
        expect(document.documentElement.dataset.navigationTransition).toBe(
            'reveal',
        );
        transition.resolve();
        await transition.promise;

        revealNavigationTransition('/jobs');
        expect(
            document.documentElement.dataset.navigationTransition,
        ).toBeUndefined();
    });

    test('keeps the newest navigation active when an earlier one is cancelled', async () => {
        browser();
        const first = Promise.withResolvers<void>();
        const second = Promise.withResolvers<void>();
        captureNavigationTransition({ finished: first.promise });
        captureNavigationTransition({ finished: second.promise });
        first.reject(new Error('Superseded by a rapid second click'));
        await first.promise.catch(() => {});
        expect(motionEnabled()).toBe(false);
        expect(document.documentElement.dataset.navigationTransition).toBe(
            'capture',
        );
        second.resolve();
        await second.promise;
        expect(motionEnabled()).toBe(true);
    });

    test('suppresses local animations until the latest navigation finishes', async () => {
        browser();
        const first = Promise.withResolvers<void>();
        const second = Promise.withResolvers<void>();

        captureNavigationTransition({ finished: first.promise });
        expect(motionEnabled()).toBe(false);
        expect(document.documentElement.dataset.navigationTransition).toBe(
            'capture',
        );

        captureNavigationTransition({ finished: second.promise });
        first.resolve();
        await first.promise;
        expect(motionEnabled()).toBe(false);

        second.resolve();
        await second.promise;
        expect(motionEnabled()).toBe(true);
        expect(
            document.documentElement.dataset.navigationTransition,
        ).toBeUndefined();
    });

    test('restores local animations after a cancelled navigation', async () => {
        browser();
        const transition = Promise.withResolvers<void>();
        captureNavigationTransition({ finished: transition.promise });
        transition.reject(new Error('Transition skipped'));
        await transition.promise.catch(() => {});
        expect(motionEnabled()).toBe(true);
        expect(
            document.documentElement.dataset.navigationTransition,
        ).toBeUndefined();
    });

    test('defers a first reveal until the latest navigation settles', async () => {
        browser();
        const reveal = createNavigationReveal();
        const first = Promise.withResolvers<void>();
        const second = Promise.withResolvers<void>();
        expect(reveal.getSnapshot()).toBeNull();

        captureNavigationTransition({ finished: first.promise });
        const firstPending = reveal.getSnapshot();
        expect(firstPending).toBeInstanceOf(Promise);
        expect(reveal.getSnapshot()).toBe(firstPending);

        captureNavigationTransition({ finished: second.promise });
        const secondPending = reveal.getSnapshot();
        expect(secondPending).not.toBe(firstPending);
        first.resolve();
        await firstPending;
        expect(reveal.getSnapshot()).toBe(secondPending);

        second.reject(new Error('Transition skipped'));
        await secondPending;
        expect(reveal.getSnapshot()).toBeNull();
    });

    test('keeps committed previews visible during subsequent navigation', async () => {
        browser();
        const reveal = createNavigationReveal();
        reveal.markRevealed();
        const next = Promise.withResolvers<void>();
        captureNavigationTransition({ finished: next.promise });
        expect(reveal.getSnapshot()).toBeNull();
        next.resolve();
        await next.promise;
    });
});
