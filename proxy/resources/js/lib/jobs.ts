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
                rowClassName:
                    'bg-sky-50/60 dark:bg-sky-500/10 dark:hover:bg-sky-500/15',
                cardClassName:
                    'border-l-sky-500 bg-sky-50/60 dark:border-l-sky-400 dark:bg-sky-500/10',
                badgeClassName:
                    'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-400/70 dark:bg-sky-500/15 dark:text-sky-100',
                progressClassName: 'bg-sky-500 dark:bg-sky-400',
            },
            accepted: {
                label: 'ACCEPTED',
                icon: CircleDashedIcon,
                rowClassName:
                    'bg-blue-50/60 dark:bg-blue-500/10 dark:hover:bg-blue-500/15',
                cardClassName:
                    'border-l-blue-500 bg-blue-50/60 dark:border-l-blue-400 dark:bg-blue-500/10',
                badgeClassName:
                    'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-400/70 dark:bg-blue-500/15 dark:text-blue-100',
                progressClassName: 'bg-blue-500 dark:bg-blue-400',
            },
            running: {
                label: 'RUNNING',
                icon: ActivityIcon,
                rowClassName:
                    'bg-amber-50/70 dark:bg-amber-500/10 dark:hover:bg-amber-500/15',
                cardClassName:
                    'border-l-amber-500 bg-amber-50/70 dark:border-l-amber-400 dark:bg-amber-500/10',
                badgeClassName:
                    'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-400/70 dark:bg-amber-500/15 dark:text-amber-100',
                progressClassName: 'bg-amber-500 dark:bg-amber-400',
            },
            successful: {
                label: 'SUCCESSFUL',
                icon: CheckCircle2Icon,
                rowClassName:
                    'bg-emerald-50/70 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15',
                cardClassName:
                    'border-l-emerald-500 bg-emerald-50/70 dark:border-l-emerald-400 dark:bg-emerald-500/10',
                badgeClassName:
                    'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-emerald-100',
                progressClassName: 'bg-emerald-500 dark:bg-emerald-400',
            },
            failed: {
                label: 'FAILED',
                icon: CircleAlertIcon,
                rowClassName:
                    'bg-red-50/70 dark:bg-red-500/10 dark:hover:bg-red-500/15',
                cardClassName:
                    'border-l-red-500 bg-red-50/70 dark:border-l-red-400 dark:bg-red-500/10',
                badgeClassName:
                    'border-red-300 bg-red-50 text-red-700 dark:border-red-400/70 dark:bg-red-500/15 dark:text-red-100',
                progressClassName: 'bg-red-500 dark:bg-red-400',
            },
            submission_failed: {
                label: 'SUBMISSION FAILED',
                icon: XCircleIcon,
                rowClassName:
                    'bg-red-50/70 dark:bg-red-500/10 dark:hover:bg-red-500/15',
                cardClassName:
                    'border-l-red-500 bg-red-50/70 dark:border-l-red-400 dark:bg-red-500/10',
                badgeClassName:
                    'border-red-300 bg-red-50 text-red-700 dark:border-red-400/70 dark:bg-red-500/15 dark:text-red-100',
                progressClassName: 'bg-red-500 dark:bg-red-400',
            },
            remote_missing: {
                label: 'REMOTE MISSING',
                icon: HelpCircleIcon,
                rowClassName: 'bg-muted/40 dark:bg-muted/30',
                cardClassName:
                    'border-l-muted-foreground bg-muted/40 dark:bg-muted/30',
                badgeClassName:
                    'border-muted-foreground/30 bg-muted dark:bg-muted/60',
                progressClassName: 'bg-muted-foreground',
            },
        }[status] ?? {
            label: status.replaceAll('_', ' ').toUpperCase(),
            icon: HelpCircleIcon,
            rowClassName: 'bg-muted/30 dark:bg-muted/20',
            cardClassName:
                'border-l-muted-foreground bg-muted/30 dark:bg-muted/20',
            badgeClassName:
                'border-muted-foreground/30 bg-muted dark:bg-muted/60',
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
