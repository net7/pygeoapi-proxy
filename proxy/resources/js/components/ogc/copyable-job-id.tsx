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

export default function CopyableJobId({
    displayJobId,
}: {
    displayJobId: string;
}) {
    const [, copy] = useClipboard();

    const copyDisplayJobId = async (
        event: MouseEvent<HTMLButtonElement>,
    ): Promise<void> => {
        event.stopPropagation();

        if (await copy(displayJobId)) {
            toast.success('Job ID copied', {
                description: displayJobId,
            });

            return;
        }

        toast.error('Unable to copy Job ID', {
            description: 'Clipboard access is not available.',
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
                    aria-label={`Copy job ID ${displayJobId}`}
                    onClick={copyDisplayJobId}
                >
                    <span className="font-mono whitespace-nowrap">
                        {displayJobId}
                    </span>
                    <CopyIcon data-icon="inline-end" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
                Click to copy this job ID.
            </TooltipContent>
        </Tooltip>
    );
}
