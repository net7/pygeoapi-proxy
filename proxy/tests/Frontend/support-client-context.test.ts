import { expect, spyOn, test } from 'bun:test';
import { collectSupportClientContext } from '../../resources/js/lib/support-client-context';

function withClient(callback: () => void) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            navigator: { language: 'it-IT', cookieEnabled: true },
            innerWidth: 1440,
            innerHeight: 900,
            location: { href: 'https://example.org/private?token=secret' },
        },
    });

    try {
        callback();
    } finally {
        if (previous) {
            Object.defineProperty(globalThis, 'window', previous);
        } else {
            Reflect.deleteProperty(globalThis, 'window');
        }
    }
}

test('diagnostics collect only language timezone and current browser window size', () => {
    withClient(() => {
        const zone = spyOn(
            Intl.DateTimeFormat.prototype,
            'resolvedOptions',
        ).mockReturnValue({
            timeZone: 'Europe/Rome',
        } as Intl.ResolvedDateTimeFormatOptions);

        try {
            expect(collectSupportClientContext()).toEqual({
                language: 'it-IT',
                timezone: 'Europe/Rome',
                viewport_width: 1440,
                viewport_height: 900,
            });
            window.innerWidth = 390;
            expect(collectSupportClientContext().viewport_width).toBe(390);
        } finally {
            zone.mockRestore();
        }
    });
});

test('unavailable timezone and invalid dimensions do not prevent sending support', () => {
    withClient(() => {
        const zone = spyOn(
            Intl.DateTimeFormat.prototype,
            'resolvedOptions',
        ).mockImplementation(() => {
            throw new Error('unavailable');
        });

        try {
            window.innerWidth = 0;
            window.innerHeight = Number.NaN;
            expect(collectSupportClientContext()).toEqual({
                language: 'it-IT',
            });
        } finally {
            zone.mockRestore();
        }
    });
});

test('diagnostics are absent outside a browser', () => {
    expect(collectSupportClientContext()).toEqual({});
});
