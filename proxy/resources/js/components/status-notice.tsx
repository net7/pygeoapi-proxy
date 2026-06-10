import { CircleCheckIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StatusNotice({
    message,
    title = 'Notification',
}: {
    message?: string;
    title?: string;
}) {
    if (!message) {
        return null;
    }

    return (
        <Alert>
            <CircleCheckIcon className="text-primary" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}
