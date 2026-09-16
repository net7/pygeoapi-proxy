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
                rowClassName: 'bg-info/5 hover:bg-info/10',
                cardClassName: 'border-l-info bg-info/5',
                badgeClassName: 'border-info/25 bg-info/10 text-info-emphasis',
                progressClassName: 'bg-info',
            },
            accepted: {
                label: 'ACCEPTED',
                icon: CircleDashedIcon,
                rowClassName: 'bg-primary/5 hover:bg-primary/10',
                cardClassName: 'border-l-primary bg-primary/5',
                badgeClassName: 'border-primary/25 bg-primary/10 text-primary',
                progressClassName: 'bg-primary',
            },
            running: {
                label: 'RUNNING',
                icon: ActivityIcon,
                rowClassName: 'bg-warning/5 hover:bg-warning/10',
                cardClassName: 'border-l-warning bg-warning/5',
                badgeClassName:
                    'border-warning/25 bg-warning/10 text-warning-emphasis',
                progressClassName: 'bg-warning',
            },
            successful: {
                label: 'SUCCESSFUL',
                icon: CheckCircle2Icon,
                rowClassName: 'bg-success/5 hover:bg-success/10',
                cardClassName: 'border-l-success bg-success/5',
                badgeClassName:
                    'border-success/25 bg-success/10 text-success-emphasis',
                progressClassName: 'bg-success',
            },
            failed: {
                label: 'FAILED',
                icon: CircleAlertIcon,
                rowClassName:
                    'bg-destructive-emphasis/5 hover:bg-destructive-emphasis/10',
                cardClassName:
                    'border-l-destructive-emphasis bg-destructive-emphasis/5',
                badgeClassName:
                    'border-destructive-emphasis/25 bg-destructive-emphasis/10 text-destructive-emphasis',
                progressClassName: 'bg-destructive-emphasis',
            },
            submission_failed: {
                label: 'SUBMISSION FAILED',
                icon: XCircleIcon,
                rowClassName:
                    'bg-destructive-emphasis/5 hover:bg-destructive-emphasis/10',
                cardClassName:
                    'border-l-destructive-emphasis bg-destructive-emphasis/5',
                badgeClassName:
                    'border-destructive-emphasis/25 bg-destructive-emphasis/10 text-destructive-emphasis',
                progressClassName: 'bg-destructive-emphasis',
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
