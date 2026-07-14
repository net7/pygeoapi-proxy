import type { ReactNode } from 'react';

import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export default function SectionFieldSet({
    label,
    description,
    children,
    className,
}: {
    label: string;
    description?: string | null;
    children: ReactNode;
    className?: string;
}) {
    return (
        <FieldSet
            className={cn(
                'max-w-full min-w-0 gap-4 rounded-md border bg-muted/30 p-4 shadow-xs dark:border-border/70 dark:bg-muted/20',
                className,
            )}
        >
            <FieldLegend className="mb-1 w-fit px-1 text-sm">
                {label}
            </FieldLegend>
            {description ? (
                <FieldDescription className="break-words">
                    {description}
                </FieldDescription>
            ) : null}
            {children}
        </FieldSet>
    );
}
