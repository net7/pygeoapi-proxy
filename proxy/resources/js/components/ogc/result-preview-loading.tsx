import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export default function ResultPreviewLoading({
    className,
}: {
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex min-h-80 items-center justify-center',
                className,
            )}
        >
            <Spinner className="size-5" />
        </div>
    );
}
