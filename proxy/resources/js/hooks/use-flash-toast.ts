import { router } from '@inertiajs/react';
import {
    AlertTriangleIcon,
    CheckCircle2Icon,
    CircleAlertIcon,
    InfoIcon,
} from 'lucide-react';
import { createElement, useEffect } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            toast[data.type](data.title ?? data.message, {
                description:
                    data.description ??
                    (data.title
                        ? data.message
                        : getToastDescription(data.type)),
                icon: getToastIcon(data.type),
            });
        });
    }, []);
}

function getToastDescription(type: FlashToast['type']): string {
    return {
        success: 'The change has been saved.',
        info: 'New information is available.',
        warning: 'Review this before continuing.',
        error: 'The request could not be completed.',
    }[type];
}

function getToastIcon(type: FlashToast['type']): ReactNode {
    const props = {
        'aria-hidden': true,
        className:
            type === 'error'
                ? 'text-destructive'
                : type === 'info'
                  ? 'text-muted-foreground'
                  : 'text-primary',
    };

    return createElement(
        {
            success: CheckCircle2Icon,
            info: InfoIcon,
            warning: AlertTriangleIcon,
            error: CircleAlertIcon,
        }[type],
        props,
    );
}
