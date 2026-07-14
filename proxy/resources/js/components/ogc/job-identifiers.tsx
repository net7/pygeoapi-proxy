import CopyableJobId from '@/components/ogc/copyable-job-id';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

export default function JobIdentifiers({
    className,
    id,
    inline = false,
    remoteJobId,
}: {
    className?: string;
    id: number;
    inline?: boolean;
    remoteJobId?: string | null;
}) {
    const { t } = useTranslation();

    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-2',
                inline && 'sm:flex-row sm:items-end sm:gap-3',
                className,
            )}
        >
            <JobIdentifierValue label={t('jobs.localJobId')} value={`#${id}`} />

            {remoteJobId ? (
                <JobIdentifierValue
                    label={t('jobs.remoteJobId')}
                    value={remoteJobId}
                />
            ) : null}
        </div>
    );
}

function JobIdentifierValue({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <CopyableJobId displayJobId={value} />
        </div>
    );
}
