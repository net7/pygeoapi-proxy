import { Head, Link, router } from '@inertiajs/react';
import { EyeIcon, SearchIcon, XIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';

import CopyableJobId from '@/components/ogc/copyable-job-id';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { clampProgress, formatJobDate, jobStatusStyles } from '@/lib/jobs';
import { index } from '@/routes/admin/jobs';
import { show } from '@/routes/jobs';
import type { ProcessExecutionListItem } from '@/types';

type AdminJob = ProcessExecutionListItem & {
    owner: {
        id: number;
        name: string;
        email: string;
    };
};

type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type PaginatedJobs = {
    data: AdminJob[];
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

export default function AdminJobsIndex({
    executions,
    filters,
}: {
    executions: PaginatedJobs;
    filters: { search: string };
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const isFiltering = filters.search !== '';

    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        router.get(
            index.url({
                query: search ? { search } : {},
            }),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    }

    function resetSearch() {
        setSearch('');

        router.get(
            index.url(),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    }

    return (
        <>
            <Head title="Admin jobs" />

            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">
                            Admin
                        </p>
                        <h1 className="text-2xl font-semibold">Jobs</h1>
                        <p className="text-sm text-muted-foreground">
                            {executions.from ?? 0}-{executions.to ?? 0} of{' '}
                            {executions.total}
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={submitSearch}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                    <div className="relative w-full sm:w-[34rem]">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search jobs or owners..."
                            className="pl-9"
                            aria-label="Search jobs"
                        />
                    </div>

                    <Button type="submit" variant="outline" size="sm">
                        <SearchIcon data-icon="inline-start" />
                        Search
                    </Button>

                    {isFiltering && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetSearch}
                        >
                            <XIcon data-icon="inline-start" />
                            Reset
                        </Button>
                    )}
                </form>

                <div className="overflow-hidden rounded-md border bg-card shadow-sm dark:border-border/70 dark:bg-card/95">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-52">
                                    Owner
                                </TableHead>
                                <TableHead className="min-w-56">
                                    Process
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Job ID</TableHead>
                                <TableHead className="min-w-36">
                                    Progress
                                </TableHead>
                                <TableHead className="min-w-36">
                                    Submitted
                                </TableHead>
                                <TableHead className="min-w-36">
                                    Finished
                                </TableHead>
                                <TableHead className="w-28 text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {executions.data.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No jobs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                executions.data.map((execution) => (
                                    <TableRow key={execution.id}>
                                        <TableCell>
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate font-medium">
                                                    {execution.owner.name}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {execution.owner.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <span className="truncate font-medium">
                                                    {execution.processTitle ??
                                                        execution.processId}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {execution.processId}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <JobStatusBadge
                                                status={execution.status}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <CopyableJobId
                                                displayJobId={
                                                    execution.remoteJobId ??
                                                    `Local #${execution.id}`
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ProgressMeter
                                                progress={execution.progress}
                                                status={execution.status}
                                            />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatJobDate(
                                                execution.submittedAt,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatJobDate(
                                                execution.completedAt ??
                                                    execution.failedAt,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link href={show(execution.id)}>
                                                    <EyeIcon data-icon="inline-start" />
                                                    View
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pagination links={executions.links} />
            </div>
        </>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles = jobStatusStyles(status);
    const Icon = styles.icon;

    return (
        <Badge variant="outline" className={styles.badgeClassName}>
            <Icon data-icon="inline-start" />
            {styles.label}
        </Badge>
    );
}

function ProgressMeter({
    progress,
    status,
}: {
    progress: number;
    status: string;
}) {
    const value = clampProgress(progress);
    const styles = jobStatusStyles(status);

    return (
        <div className="flex min-w-32 items-center gap-3">
            <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                    className={styles.progressClassName}
                    style={{ width: `${value}%`, height: '100%' }}
                />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {value}%
            </span>
        </div>
    );
}

function Pagination({ links }: { links: PaginationLink[] }) {
    const visibleLinks = links.filter(
        (link) => link.url !== null || link.active,
    );

    if (visibleLinks.length <= 1) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {visibleLinks.map((link, index) =>
                link.url ? (
                    <Button
                        key={`${link.label}-${index}`}
                        asChild
                        size="sm"
                        variant={link.active ? 'default' : 'outline'}
                    >
                        <Link href={link.url} preserveScroll>
                            {paginationLabel(link.label)}
                        </Link>
                    </Button>
                ) : (
                    <Button
                        key={`${link.label}-${index}`}
                        size="sm"
                        variant="outline"
                        disabled
                    >
                        {paginationLabel(link.label)}
                    </Button>
                ),
            )}
        </div>
    );
}

function paginationLabel(label: string) {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .replace('Previous', 'Prev')
        .trim();
}

AdminJobsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Admin jobs',
            href: index(),
        },
    ],
};
