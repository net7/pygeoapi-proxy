import type { ReactNode } from 'react';

import {
    OgcFieldError,
    ogcValidationContainerClassName,
    ogcValidationDataState,
} from '@/components/ogc/field-validation-feedback';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { errorIdForPath } from '@/lib/ogc-form-errors';
import type { OgcFieldValidationState } from '@/lib/ogc-form-validation';
import { cn } from '@/lib/utils';

export default function SectionFieldSet({
    label,
    description,
    children,
    className,
    fieldPath,
    error,
    validationState,
}: {
    label: string;
    description?: string | null;
    children: ReactNode;
    className?: string;
    fieldPath?: string;
    error?: string;
    validationState?: OgcFieldValidationState;
}) {
    const errorId = fieldPath ? errorIdForPath(fieldPath) : undefined;
    const resolvedValidationState =
        validationState ?? (error ? 'invalid' : 'neutral');

    return (
        <FieldSet
            className={cn(
                'block max-w-full min-w-0 gap-4 rounded-md border bg-muted/30 p-4 shadow-xs dark:border-border/70 dark:bg-muted/20',
                ogcValidationContainerClassName(resolvedValidationState),
                className,
            )}
            data-field-path={fieldPath}
            data-invalid={
                resolvedValidationState === 'invalid' ? true : undefined
            }
            data-validation-state={ogcValidationDataState(
                resolvedValidationState,
            )}
            tabIndex={fieldPath ? -1 : undefined}
            aria-invalid={
                resolvedValidationState === 'invalid' ? true : undefined
            }
            aria-describedby={error ? errorId : undefined}
        >
            <FieldLegend
                className={cn(
                    'mb-1 w-fit px-1 text-sm',
                    resolvedValidationState === 'invalid' &&
                        'text-destructive-emphasis',
                )}
            >
                {label}
            </FieldLegend>
            <div className="flex min-w-0 flex-col gap-4">
                {description ? (
                    <FieldDescription className="break-words">
                        {description}
                    </FieldDescription>
                ) : null}
                <OgcFieldError id={errorId} message={error} />
                {children}
            </div>
        </FieldSet>
    );
}
