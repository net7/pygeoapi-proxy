import type { SupportClientContext } from '@/types/support';

export function collectSupportClientContext(): SupportClientContext {
    if (typeof window === 'undefined') {
        return {};
    }

    const context: SupportClientContext = {};

    if (window.navigator.language) {
        context.language = window.navigator.language.slice(0, 64);
    }

    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (timezone) {
            context.timezone = timezone.slice(0, 100);
        }
    } catch {
        // Restricted browser settings may make the time zone unavailable.
    }

    if (
        Number.isInteger(window.innerWidth) &&
        window.innerWidth > 0 &&
        window.innerWidth <= 100000
    ) {
        context.viewport_width = window.innerWidth;
    }

    if (
        Number.isInteger(window.innerHeight) &&
        window.innerHeight > 0 &&
        window.innerHeight <= 100000
    ) {
        context.viewport_height = window.innerHeight;
    }

    return context;
}
