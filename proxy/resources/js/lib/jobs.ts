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

const failureStatuses = ['failed', 'submission_failed', 'remote_missing'];
const activeResultCollectionStatuses = ['pending', 'collecting'];

export function isJobTerminal(status: string): boolean {
    return terminalStatuses.includes(status);
}

export function isJobFailure(status: string): boolean {
    return failureStatuses.includes(status);
}

export function isResultCollectionActive(
    status: string | null | undefined,
): boolean {
    return activeResultCollectionStatuses.includes(status ?? '');
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
    ...options: [locale?: Intl.LocalesArgument, unavailableLabel?: string]
): string {
    const [locale, unavailableLabel = 'Not available'] = options;

    return formatDateValue(value, locale, unavailableLabel);
}

export function clampProgress(progress: number): number {
    return Math.min(Math.max(progress, 0), 100);
}

function formatDateValue(
    value: string | null | undefined,
    locale: Intl.LocalesArgument | undefined,
    unavailableLabel = 'Not available',
): string {
    if (!value) {
        return unavailableLabel;
    }

    const trimmedValue = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch.map(Number);

        if (!isValidDateParts(year, month, day)) {
            return unavailableLabel;
        }

        return formatDateParts(new Date(year, month - 1, day), locale, false);
    }

    const date = new Date(trimmedValue);

    if (Number.isNaN(date.getTime())) {
        return unavailableLabel;
    }

    return formatDateParts(
        date,
        locale,
        /[T\s]\d{1,2}:\d{2}/.test(trimmedValue),
    );
}

function formatDateParts(
    date: Date,
    locale: Intl.LocalesArgument | undefined,
    includeTime: boolean,
): string {
    const formatter = new Intl.DateTimeFormat(locale ?? browserDateLocale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(includeTime
            ? ({
                  hour: '2-digit',
                  hourCycle: 'h23',
                  minute: '2-digit',
              } satisfies Intl.DateTimeFormatOptions)
            : {}),
    });
    const parts = formatter.formatToParts(date);
    const formattedDate = parts
        .filter((part) => ['day', 'month', 'year'].includes(part.type))
        .map((part) => part.value)
        .join('/');

    if (!includeTime) {
        return formattedDate;
    }

    const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';

    return `${formattedDate} ${hour}:${minute}`;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function browserDateLocale(): Intl.LocalesArgument {
    if (typeof navigator === 'undefined') {
        return undefined;
    }

    return navigator.languages.length > 0
        ? navigator.languages
        : navigator.language;
}
