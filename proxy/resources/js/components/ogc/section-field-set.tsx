import type { ReactNode } from 'react';

import InputError from '@/components/input-error';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { errorIdForPath } from '@/lib/ogc-form-errors';
import { cn } from '@/lib/utils';

export default function SectionFieldSet({
    label,
    description,
    children,
    className,
    fieldPath,
    error,
}: {
    label: string;
    description?: string | null;
    children: ReactNode;
    className?: string;
    fieldPath?: string;
    error?: string;
}) {
    const errorId = fieldPath ? errorIdForPath(fieldPath) : undefined;

    return (
        <FieldSet
            className={cn(
                'block max-w-full min-w-0 gap-4 rounded-md border bg-muted/30 p-4 shadow-xs dark:border-border/70 dark:bg-muted/20',
                className,
            )}
            data-field-path={fieldPath}
            tabIndex={fieldPath ? -1 : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
        >
            <FieldLegend className="mb-1 w-fit px-1 text-sm">
                {label}
            </FieldLegend>
            <div className="flex min-w-0 flex-col gap-4">
                {description ? (
                    <FieldDescription className="break-words">
                        {description}
                    </FieldDescription>
                ) : null}
                <InputError id={errorId} message={error} />
                {children}
            </div>
        </FieldSet>
    );
}
