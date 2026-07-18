import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { FieldError } from '@/components/ui/field';
import type { OgcFieldValidationState } from '@/lib/ogc-form-validation';
import { cn } from '@/lib/utils';

export function OgcFieldError({
    id,
    message,
}: {
    id?: string;
    message?: string;
}) {
    if (!message) {
        return null;
    }

    return (
        <FieldError
            id={id}
            className="flex items-start gap-2 rounded-md border border-destructive-emphasis bg-destructive/10 px-3 py-2 text-destructive-emphasis shadow-xs [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0"
        >
            <CircleAlertIcon aria-hidden="true" />
            <span className="min-w-0 break-words">{message}</span>
        </FieldError>
    );
}

export function OgcValidationControl({
    state,
    validLabel,
    hasBuiltInEndIcon = false,
    children,
}: {
    state: OgcFieldValidationState;
    validLabel: string;
    hasBuiltInEndIcon?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="relative min-w-0">
            {children}
            {state === 'corrected' ? (
                <span
                    role="status"
                    className={cn(
                        'pointer-events-none absolute top-1/2 -translate-y-1/2 text-success [&>svg]:size-4',
                        hasBuiltInEndIcon ? 'right-9' : 'right-3',
                    )}
                >
                    <CircleCheckIcon aria-hidden="true" />
                    <span className="sr-only">{validLabel}</span>
                </span>
            ) : null}
        </div>
    );
}

export function ogcValidationControlClassName(
    state: OgcFieldValidationState,
    hasBuiltInEndIcon = false,
): string {
    return cn(
        state === 'invalid' &&
            'border-destructive-emphasis ring-[3px] ring-destructive-emphasis/80 focus-visible:border-destructive-emphasis focus-visible:ring-destructive-emphasis/90 aria-invalid:border-destructive-emphasis aria-invalid:ring-destructive-emphasis/80 dark:aria-invalid:ring-destructive-emphasis/80',
        state === 'corrected' && [
            'border-success ring-[3px] ring-success/20 focus-visible:border-success focus-visible:ring-success/30',
            hasBuiltInEndIcon ? 'pr-14' : 'pr-10',
        ],
    );
}

export function ogcValidationContainerClassName(
    state: OgcFieldValidationState,
): string {
    return cn(
        state === 'invalid' &&
            'border-destructive-emphasis ring-[3px] ring-destructive-emphasis/80',
        state === 'corrected' && 'border-success ring-[3px] ring-success/20',
    );
}

export function ogcValidationFieldClassName(
    state: OgcFieldValidationState,
): string {
    return cn(
        state === 'invalid' && 'data-[invalid=true]:text-destructive-emphasis',
    );
}

export function ogcValidationDataState(
    state: OgcFieldValidationState,
): 'valid' | undefined {
    return state === 'corrected' ? 'valid' : undefined;
}
