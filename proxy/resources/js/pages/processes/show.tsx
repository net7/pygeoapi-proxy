import { Head } from '@inertiajs/react';

import DynamicProcessForm from '@/components/ogc/dynamic-process-form';
import { index } from '@/routes/processes';
import type { OgcFormSchema } from '@/types';

export default function ProcessShow({
    formSchema,
}: {
    formSchema: OgcFormSchema;
}) {
    return (
        <>
            <Head title={formSchema.title} />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold">
                        {formSchema.title}
                    </h1>
                    <p className="text-sm text-muted-foreground">
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
