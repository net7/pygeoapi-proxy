import { Head } from '@inertiajs/react';

import DynamicProcessForm from '@/components/ogc/dynamic-process-form';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { index } from '@/routes/processes';
import type { OgcCacheStatus, OgcFormSchema } from '@/types';

export default function ProcessShow({
    formSchema,
    processStatus = 'ready',
}: {
    formSchema: OgcFormSchema | null;
    processStatus?: OgcCacheStatus;
}) {
    if (processStatus === 'warming' || formSchema === null) {
        return (
            <>
                <Head title="Process preparing" />

                <div className="flex min-w-0 flex-col gap-4 p-4">
                    <Alert>
                        <Spinner className="text-primary" />
                        <AlertTitle>
                            Process description is being prepared
                        </AlertTitle>
                        <AlertDescription>
                            The process form will appear when the background
                            warm-up finishes.
                        </AlertDescription>
                    </Alert>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={formSchema.title} />

            <div className="flex min-w-0 flex-col gap-4 p-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-2xl font-semibold">
                        {formSchema.title}
                    </h1>
                    <p className="text-sm break-words text-muted-foreground">
                        {formSchema.description}
                    </p>
                </div>

                <DynamicProcessForm schema={formSchema} />
            </div>
        </>
    );
}

ProcessShow.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            href: index(),
        },
    ],
};
