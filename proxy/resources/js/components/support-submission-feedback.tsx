import {
    MailCheckIcon,
    MailIcon,
    MailWarningIcon,
    SendIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

export type SupportSubmissionFeedbackProps = {
    status: 'sending' | 'success' | 'error';
    email: string;
    progress?: number | null;
    error?: string;
    onEdit: () => void;
};

export function SupportSubmissionFeedback({
    status,
    email,
    progress = null,
    error,
    onEdit,
}: SupportSubmissionFeedbackProps) {
    const { t } = useTranslation();
    const heading = useRef<HTMLHeadingElement>(null);
    const title = {
        sending: t('support.sending'),
        success: t('support.successTitle'),
        error: t('support.failureTitle'),
    }[status];

    useEffect(() => {
        heading.current?.focus();
    }, [status]);

    return (
        <div className="flex min-h-80 flex-col items-center justify-center gap-7 px-2 py-10 text-center">
            <div
                className={cn(
                    'relative flex size-20 items-center justify-center rounded-full ring-1 ring-inset',
                    status === 'sending' &&
                        'bg-primary/10 text-primary ring-primary/15',
                    status === 'success' &&
                        'bg-success-emphasis/10 text-success-emphasis ring-success-emphasis/20',
                    status === 'error' &&
                        'bg-warning-emphasis/10 text-warning-emphasis ring-warning-emphasis/20',
                )}
                aria-hidden="true"
            >
                {status === 'sending' ? (
                    <>
                        <Spinner className="absolute size-16" strokeWidth={1} />
                        <SendIcon className="size-7" strokeWidth={1.5} />
                    </>
                ) : status === 'success' ? (
                    <MailCheckIcon className="size-9" strokeWidth={1.5} />
                ) : (
                    <MailWarningIcon className="size-9" strokeWidth={1.5} />
                )}
            </div>
            <div
                role="status"
                aria-atomic="true"
                className="max-w-md space-y-3"
            >
                <h3
                    ref={heading}
                    tabIndex={-1}
                    className="text-xl font-semibold tracking-tight outline-none sm:text-2xl"
                >
                    {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {status === 'sending'
                        ? t('support.sendingDescription')
                        : status === 'success'
                          ? t('support.successDescription')
                          : error || t('support.failureDescription')}
                </p>
                {status === 'success' && (
                    <p className="flex min-w-0 items-start justify-center gap-2 text-sm font-medium">
                        <MailIcon
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <span className="break-all">{email}</span>
                    </p>
                )}
            </div>
            {status === 'sending' && progress !== null && (
                <div className="w-full max-w-56 space-y-2">
                    <div
                        role="progressbar"
                        aria-label={t('support.uploadProgress', {
                            percent: progress,
                        })}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="h-1.5 overflow-hidden rounded-full bg-primary/10"
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {t('support.uploadProgress', { percent: progress })}
                    </p>
                </div>
            )}
            {status === 'error' && (
                <Button type="button" onClick={onEdit}>
                    {t('support.backToRequest')}
                </Button>
            )}
        </div>
    );
}
