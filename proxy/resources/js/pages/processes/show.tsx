import { Head } from '@inertiajs/react';
import { ChevronDownIcon, CopyCheckIcon, FileTextIcon } from 'lucide-react';

import CacheWarmupPoller from '@/components/ogc/cache-warmup-poller';
import DynamicProcessForm from '@/components/ogc/dynamic-process-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { formatJobDate } from '@/lib/jobs';
import { index } from '@/routes/processes';
import type { OgcCacheStatus, OgcFormSchema, OgcInputPrefill } from '@/types';

export default function ProcessShow({
    formSchema,
    processStatus = 'ready',
    processLastUpdatedAt = null,
    inputPrefill = null,
}: {
    formSchema: OgcFormSchema | null;
    processStatus?: OgcCacheStatus;
    processLastUpdatedAt?: string | null;
    inputPrefill?: OgcInputPrefill | null;
}) {
    const { t, locale } = useTranslation();

    if (processStatus === 'warming' || formSchema === null) {
        return (
            <>
                <Head title={t('ogc.processPreparing')} />
                <CacheWarmupPoller
                    interval={3000}
                    only={[
                        'process',
                        'processStatus',
                        'processLastUpdatedAt',
                        'formSchema',
                        'inputPrefill',
                    ]}
                />

                <div className="flex min-w-0 flex-col gap-4 p-4">
                    <Alert>
                        <Spinner className="text-primary" />
                        <AlertTitle>
                            {t('ogc.processPreparingTitle')}
                        </AlertTitle>
                        <AlertDescription>
                            {t('ogc.processPreparingDescription')}
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
                <div className="page-header flex min-w-0 flex-col gap-2">
                    <h1 className="break-words">{formSchema.title}</h1>
                    {processLastUpdatedAt ? (
                        <p className="text-xs text-muted-foreground">
                            {t('ogc.servicesLastUpdatedAt', {
                                date: formatJobDate(
                                    processLastUpdatedAt,
                                    locale,
                                    t('common.notAvailable'),
                                ),
                            })}
                        </p>
                    ) : null}
                </div>

                {formSchema.description ? (
                    <Collapsible className="w-full min-w-0 rounded-md border bg-card text-card-foreground transition-colors data-[state=open]:border-primary/25 motion-reduce:transition-none">
                        <CollapsibleTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                className="group h-auto w-full justify-between gap-3 px-3 py-2.5 text-left whitespace-normal"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <FileTextIcon
                                        aria-hidden="true"
                                        data-icon="inline-start"
                                        className="text-primary"
                                    />
                                    {t('ogc.serviceDescription')}
                                </span>
                                <ChevronDownIcon
                                    aria-hidden="true"
                                    data-icon="inline-end"
                                    className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                                />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mx-3 border-t py-3">
                                <p className="w-full min-w-0 text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                                    {formSchema.description}
                                </p>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                ) : null}

                {inputPrefill ? (
                    <Alert className="border-info-emphasis bg-info/10 text-info-emphasis shadow-xs *:data-[slot=alert-description]:text-info-emphasis/80">
                        <CopyCheckIcon aria-hidden="true" />
                        <AlertTitle>
                            {t('ogc.inputPrefillTitle', {
                                source: inputPrefill.sourceJobName,
                            })}
                        </AlertTitle>
                        <AlertDescription className="flex flex-col gap-1">
                            <span>{t('ogc.inputPrefillDescription')}</span>
                            {inputPrefill.skippedInputs.length > 0 ? (
                                <span className="font-medium text-amber-700 dark:text-amber-300">
                                    {t('ogc.inputPrefillSkipped', {
                                        inputs: inputPrefill.skippedInputs.join(
                                            ', ',
                                        ),
                                    })}
                                </span>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <DynamicProcessForm
                    schema={formSchema}
                    inputPrefill={inputPrefill}
                />
            </div>
        </>
    );
}

ProcessShow.layout = {
    breadcrumbs: [
        {
            title: 'Processes',
            titleKey: 'ogc.processesTitle',
            href: index(),
        },
    ],
};
