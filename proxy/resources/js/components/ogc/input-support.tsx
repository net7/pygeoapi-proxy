import { CircleCheckIcon, LifeBuoyIcon } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import { cn } from '@/lib/utils';
import type { OgcNormalizedField } from '@/types';

export const InputSupportContext = createContext<{
    showReferences: boolean;
    toggleReferences: () => void;
} | null>(null);

export function InputSupport({ children }: { children: ReactNode }) {
    const [showReferences, setShowReferences] = useState(false);

    return (
        <InputSupportContext
            value={{
                showReferences,
                toggleReferences: () =>
                    setShowReferences((visible) => !visible),
            }}
        >
            {children}
        </InputSupportContext>
    );
}

export function InputSupportToggle({
    onShowReferences,
}: {
    onShowReferences?: () => void;
}) {
    const support = useContext(InputSupportContext);
    const { t } = useTranslation();

    if (!support) {
        throw new Error('InputSupportToggle must be used within InputSupport.');
    }

    const SupportIcon = support.showReferences ? CircleCheckIcon : LifeBuoyIcon;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant={support.showReferences ? 'default' : 'outline'}
                    size="sm"
                    className="h-auto min-h-8 max-w-full justify-start text-left whitespace-normal"
                    aria-pressed={support.showReferences}
                    onClick={() => {
                        if (!support.showReferences) {
                            onShowReferences?.();
                        }

                        support.toggleReferences();
                    }}
                >
                    <SupportIcon data-icon="inline-start" aria-hidden="true" />
                    {t('ogc.showSupportReferences')}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
                {t('ogc.showSupportReferencesTooltip')}
            </TooltipContent>
        </Tooltip>
    );
}

export function FieldLabelWithSupport({
    field,
    htmlFor,
}: {
    field: Pick<OgcNormalizedField, 'name' | 'title'>;
    htmlFor?: string;
}) {
    const support = useContext(InputSupportContext);
    const label = fieldDisplayLabel(field);

    return (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <FieldLabel
                htmlFor={htmlFor}
                className={cn(
                    support?.showReferences &&
                        label === field.name &&
                        'sr-only',
                )}
            >
                {label}
            </FieldLabel>
            <FieldSupportReference name={field.name} />
        </div>
    );
}

export function FieldSupportReference({
    name,
    className,
}: {
    name: string;
    className?: string;
}) {
    const support = useContext(InputSupportContext);
    const [, copy] = useClipboard();
    const { t } = useTranslation();

    if (!support?.showReferences) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
                'h-auto min-h-6 max-w-full min-w-0 p-0 text-left align-baseline whitespace-normal text-muted-foreground underline-offset-4 hover:underline',
                className,
            )}
            aria-label={t('ogc.copySupportReference', { name })}
            title={t('ogc.copySupportReference', { name })}
            onClick={async () => {
                if (await copy(name)) {
                    toast.success(t('ogc.supportReferenceCopied'));
                } else {
                    toast.error(t('ogc.supportReferenceCopyError'));
                }
            }}
        >
            <code className="min-w-0 break-all" translate="no">
                ({name})
            </code>
        </Button>
    );
}
