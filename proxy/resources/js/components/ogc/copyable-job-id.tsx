import { CopyIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';

export default function CopyableJobId({
    displayJobId,
}: {
    displayJobId: string;
}) {
    const [, copy] = useClipboard();
    const { t } = useTranslation();

    const copyDisplayJobId = async (
        event: MouseEvent<HTMLButtonElement>,
    ): Promise<void> => {
        event.stopPropagation();

        if (await copy(displayJobId)) {
            toast.success(t('jobs.jobIdCopied'), {
                description: displayJobId,
            });

            return;
        }

        toast.error(t('jobs.jobIdCopyError'), {
            description: t('jobs.jobIdCopyUnavailable'),
        });
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer justify-start"
                    aria-label={t('jobs.jobIdCopyLabel', {
                        jobId: displayJobId,
                    })}
                    onClick={copyDisplayJobId}
                >
                    <span className="font-mono whitespace-nowrap">
                        {displayJobId}
                    </span>
                    <CopyIcon data-icon="inline-end" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
                {t('jobs.jobIdCopyTooltip')}
            </TooltipContent>
        </Tooltip>
    );
}
