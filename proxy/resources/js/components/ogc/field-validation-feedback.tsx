import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { FieldError } from '@/components/ui/field';
import type { OgcFieldValidationState } from '@/lib/ogc-form-validation';
import { cn } from '@/lib/utils';

type OgcFieldErrorVariant = 'default' | 'compact';

export function OgcFieldError({
    id,
    message,
    variant = 'default',
}: {
    id?: string;
    message?: string;
    variant?: OgcFieldErrorVariant;
}) {
    if (!message) {
        return null;
    }

    return (
        <FieldError
            id={id}
            className={cn(
                'flex items-start text-destructive-emphasis [&>svg]:shrink-0',
                variant === 'default'
                    ? 'gap-2 rounded-md border border-destructive-emphasis bg-destructive/10 px-3 py-2 shadow-xs [&>svg]:mt-0.5 [&>svg]:size-4'
                    : 'gap-1.5 text-xs leading-snug [&>svg]:mt-0.5 [&>svg]:size-3.5',
            )}
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
            'border-destructive-emphasis ring-[3px] ring-destructive-emphasis/20 focus-visible:border-destructive-emphasis focus-visible:ring-destructive-emphasis/30 aria-invalid:border-destructive-emphasis aria-invalid:ring-destructive-emphasis/20 dark:aria-invalid:ring-destructive-emphasis/20',
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
