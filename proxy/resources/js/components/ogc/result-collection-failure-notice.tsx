import { CircleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ResultCollectionFailureNotice({
    title,
    description,
    error,
    retryAction,
}: {
    title: string;
    description: string;
    error?: string | null;
    retryAction: ReactNode;
}) {
    return (
        <Alert className="border-warning-emphasis bg-warning/10 text-warning-emphasis *:data-[slot=alert-description]:text-warning-emphasis/80">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="gap-3">
                <p>{description}</p>
                {error ? (
                    <code className="max-w-full overflow-auto rounded-sm bg-background/70 px-2 py-1 text-xs break-words whitespace-pre-wrap">
                        {error}
                    </code>
                ) : null}
                {retryAction}
            </AlertDescription>
        </Alert>
    );
}
