import {
    ActivityIcon,
    CheckCircle2Icon,
    CircleAlertIcon,
    CircleDashedIcon,
    HelpCircleIcon,
    RadioTowerIcon,
    XCircleIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type JobStatusStyles = {
    label: string;
    icon: LucideIcon;
    rowClassName: string;
    cardClassName: string;
    badgeClassName: string;
    progressClassName: string;
};

const statusOrder = [
    'submitting',
    'accepted',
    'running',
    'successful',
    'failed',
    'submission_failed',
    'remote_missing',
];

const terminalStatuses = [
    'successful',
    'failed',
    'submission_failed',
    'remote_missing',
];

export function isJobTerminal(status: string): boolean {
    return terminalStatuses.includes(status);
}

export function jobStatusStyles(status: string): JobStatusStyles {
    return (
        {
            submitting: {
                label: 'SUBMITTING',
                icon: RadioTowerIcon,
                rowClassName: 'bg-sky-50/60 dark:bg-sky-950/20',
                cardClassName:
                    'border-l-sky-500 bg-sky-50/60 dark:bg-sky-950/20',
                badgeClassName:
                    'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
                progressClassName: 'bg-sky-500',
            },
            accepted: {
                label: 'ACCEPTED',
                icon: CircleDashedIcon,
                rowClassName: 'bg-blue-50/60 dark:bg-blue-950/20',
                cardClassName:
                    'border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20',
                badgeClassName:
                    'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
                progressClassName: 'bg-blue-500',
            },
            running: {
                label: 'RUNNING',
                icon: ActivityIcon,
                rowClassName: 'bg-amber-50/70 dark:bg-amber-950/20',
                cardClassName:
                    'border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/20',
                badgeClassName:
                    'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
                progressClassName: 'bg-amber-500',
            },
            successful: {
                label: 'SUCCESSFUL',
                icon: CheckCircle2Icon,
                rowClassName: 'bg-emerald-50/70 dark:bg-emerald-950/20',
                cardClassName:
                    'border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20',
                badgeClassName:
                    'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                progressClassName: 'bg-emerald-500',
            },
            failed: {
                label: 'FAILED',
                icon: CircleAlertIcon,
                rowClassName: 'bg-destructive/5',
                cardClassName: 'border-l-destructive bg-destructive/5',
                badgeClassName:
                    'border-destructive/40 bg-destructive/10 text-destructive',
                progressClassName: 'bg-destructive',
            },
            submission_failed: {
                label: 'SUBMISSION FAILED',
                icon: XCircleIcon,
                rowClassName: 'bg-destructive/5',
                cardClassName: 'border-l-destructive bg-destructive/5',
                badgeClassName:
                    'border-destructive/40 bg-destructive/10 text-destructive',
                progressClassName: 'bg-destructive',
            },
            remote_missing: {
                label: 'REMOTE MISSING',
                icon: HelpCircleIcon,
                rowClassName: 'bg-muted/40',
                cardClassName: 'border-l-muted-foreground bg-muted/40',
                badgeClassName: 'border-muted-foreground/30 bg-muted',
                progressClassName: 'bg-muted-foreground',
            },
        }[status] ?? {
            label: status.replaceAll('_', ' ').toUpperCase(),
            icon: HelpCircleIcon,
            rowClassName: 'bg-muted/30',
            cardClassName: 'border-l-muted-foreground bg-muted/30',
            badgeClassName: 'border-muted-foreground/30 bg-muted',
            progressClassName: 'bg-muted-foreground',
        }
    );
}

export function jobStatusSortIndex(status: string): number {
    const index = statusOrder.indexOf(status);

    return index === -1 ? statusOrder.length : index;
}

export function formatJobDate(
    value?: string | null,
    locale?: Intl.LocalesArgument,
): string {
    if (!value) {
        return 'Not available';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Not available';
    }

    return new Intl.DateTimeFormat(locale ?? browserDateLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export function clampProgress(progress: number): number {
    return Math.min(Math.max(progress, 0), 100);
}

function browserDateLocale(): Intl.LocalesArgument | undefined {
    if (typeof navigator === 'undefined') {
        return undefined;
    }

    if (navigator.languages.length > 0) {
        return navigator.languages;
    }

    return navigator.language;
}
