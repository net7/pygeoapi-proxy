import { CopyIcon } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import ResultPreviewLoading from '@/components/ogc/result-preview-loading';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';
import { copyableRawText, jsonPreviewValue } from '@/lib/raw-preview';
import type { RawPreviewKind } from '@/lib/raw-preview';
import { cn } from '@/lib/utils';

const JsonPayloadContent = lazy(
    () => import('@/components/ogc/json-payload-content'),
);

export default function RawPayloadBlock({
    data,
    kind,
    title,
    copyLabel,
    children,
    className,
}: {
    data: unknown;
    kind: RawPreviewKind;
    title?: string;
    copyLabel?: string;
    children?: ReactNode;
    className?: string;
}) {
    const [, copy] = useClipboard();
    const { t } = useTranslation();
    const copyText = copyableRawText(data, kind);

    async function copyRawPayload(): Promise<void> {
        if (await copy(copyText)) {
            toast.success(
                copyLabel ? (
                    <>
                        {t('ogc.rawCopied')} <strong>{copyLabel}</strong>
                    </>
                ) : (
                    t('ogc.rawCopied')
                ),
            );

            return;
        }

        toast.error(t('ogc.rawCopyError'), {
            description: t('jobs.jobIdCopyUnavailable'),
        });
    }

    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                {title ? (
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                        {title}
                    </h3>
                ) : (
                    <span className="sr-only">{t('ogc.rawPayload')}</span>
                )}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    aria-label={t('ogc.copyRawPayload')}
                    onClick={copyRawPayload}
                >
                    <CopyIcon data-icon="inline-start" />
                    {t('common.copy')}
                </Button>
            </div>
            {children ?? (
                <RawPayloadContent
                    data={data}
                    kind={kind}
                    copyText={copyText}
                />
            )}
        </div>
    );
}

function RawPayloadContent({
    data,
    kind,
    copyText,
}: {
    data: unknown;
    kind: RawPreviewKind;
    copyText: string;
}) {
    const jsonValue = kind === 'json' ? jsonPreviewValue(data) : null;

    if (jsonValue) {
        return (
            <Suspense fallback={<ResultPreviewLoading />}>
                <JsonPayloadContent value={jsonValue} />
            </Suspense>
        );
    }

    return (
        <pre className="max-h-[32rem] min-h-80 overflow-auto rounded-md bg-muted p-3 text-xs ring-1 ring-border/50 dark:bg-muted/50 dark:text-foreground">
            {copyText}
        </pre>
    );
}
