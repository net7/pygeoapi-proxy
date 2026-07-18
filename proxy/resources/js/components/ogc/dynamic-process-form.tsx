import { useForm } from '@inertiajs/react';
import { AlertCircleIcon, PlayIcon, WandSparklesIcon } from 'lucide-react';
import { useRef } from 'react';

import { JobNoteEditor } from '@/components/ogc/job-note-editor';
import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
} from '@/components/ogc/field-validation-feedback';
import ProcessOutputSelector from '@/components/ogc/process-output-selector';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useOgcFormValidation } from '@/hooks/use-ogc-form-validation';
import { useTranslation } from '@/hooks/use-translation';
import { markJobsIndexStale } from '@/lib/job-list-refresh';
import { fieldError } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
import {
    exampleInputsToFormValues,
    initialInputValues,
    normalizeInputs,
} from '@/lib/ogc-form-values';
import {
    buildRequestedOutputs,
    firstOutputError,
    initialOutputSelections,
} from '@/lib/process-output-selection';
import type { ProcessOutputSelections } from '@/lib/process-output-selection';
import { cn } from '@/lib/utils';
import { store } from '@/routes/processes/jobs';
import type { OgcFormSchema, OgcOutputFormat, TiptapDocument } from '@/types';

type FormOutputSelections = Record<
    string,
    Omit<ProcessOutputSelections[string], 'format'> & {
        format:
            | (Omit<OgcOutputFormat, 'schema'> & {
                  schema?: string | Record<string, any>;
              })
            | null;
    }
>;

type FormData = {
    name: string;
    inputs: Record<string, any>;
    note: TiptapDocument | null;
    outputs: FormOutputSelections;
};

export default function DynamicProcessForm({
    schema,
}: {
    schema: OgcFormSchema;
}) {
    const { t } = useTranslation();
    const formRef = useRef<HTMLFormElement>(null);
    const {
        data,
        setData,
        submit,
        transform,
        processing,
        errors,
        clearErrors,
    } = useForm<FormData>({
        name: '',
        inputs: initialInputValues(schema.fields),
        note: null,
        outputs: initialOutputSelections(schema.outputs),
    });
    const outputSelections = data.outputs;
    const fieldErrors = errors as OgcFormErrors;
    const validation = useOgcFormValidation({
        formRef,
        serverErrors: fieldErrors,
        clearServerErrors: clearErrors as (...paths: string[]) => void,
        validLabel: t('ogc.fieldValid'),
    });
    const nameError = fieldError(validation.errors, 'name');
    const nameState = validation.stateFor('name', nameError);

    function setInput(name: string, value: unknown) {
        setData('inputs', {
            ...data.inputs,
            [name]: value,
        });
    }

    function applyExamplePayload() {
        const examplePayload = schema.examplePayload;

        if (!examplePayload) {
            return;
        }

        setData((currentData) => ({
            ...currentData,
            inputs: {
                ...initialInputValues(schema.fields),
                ...exampleInputsToFormValues(
                    schema.fields,
                    examplePayload.inputs ?? {},
                ),
            },
        }));
        validation.valuesReplaced('inputs');
    }

    return (
        <form
            ref={formRef}
            className="flex max-w-full min-w-0 flex-col gap-4"
            noValidate
            onChangeCapture={validation.handleFormChange}
            onSubmit={(event) => {
                event.preventDefault();

                if (!validation.validateForm()) {
                    return;
                }

                transform((formData) => ({
                    ...formData,
                    inputs: normalizeInputs(schema.fields, formData.inputs),
                    outputs: buildRequestedOutputs(formData.outputs),
                }));
                submit(store(schema.id), {
                    onSuccess: () => markJobsIndexStale(),
                    onError: (nextErrors) => {
                        validation.focusErrors(nextErrors as OgcFormErrors);
                    },
                });
            }}
        >
            {Object.keys(validation.errors).length > 0 ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t('ogc.checkProcessData')}</AlertTitle>
                    <AlertDescription>
                        {t('ogc.someValuesNeedAttention')}
                    </AlertDescription>
                </Alert>
            ) : null}

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>{t('jobs.processName')}</CardTitle>
                    <CardDescription>
                        {t('jobs.processNameDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-2">
                    <Field
                        className="min-w-0 gap-2"
                        data-invalid={
                            nameState === 'invalid' ? true : undefined
                        }
                    >
                        <OgcValidationControl
                            state={nameState}
                            validLabel={validation.validLabel}
                        >
                            <Input
                                id="process-name"
                                value={data.name}
                                onChange={(event) =>
                                    setData('name', event.target.value)
                                }
                                placeholder={t('jobs.processNamePlaceholder')}
                                maxLength={255}
                                aria-label={t('jobs.processName')}
                                aria-invalid={
                                    nameState === 'invalid' ? true : undefined
                                }
                                data-field-path="name"
                                data-validation-state={ogcValidationDataState(
                                    nameState,
                                )}
                                aria-describedby={
                                    nameError ? 'error-name' : undefined
                                }
                                className={cn(
                                    ogcValidationControlClassName(nameState),
                                )}
                            />
                        </OgcValidationControl>
                        <OgcFieldError id="error-name" message={nameError} />
                    </Field>
                </CardContent>
            </Card>

            <Card className="min-w-0">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>{t('ogc.inputs')}</CardTitle>
                    {schema.examplePayload ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200 hover:text-amber-950 focus-visible:ring-amber-500 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
                            onClick={applyExamplePayload}
                        >
                            <WandSparklesIcon data-icon="inline-start" />
                            {t('ogc.prefillTestData')}
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-4">
                    {Object.entries(schema.fields).map(([name, field]) => (
                        <SchemaFieldRenderer
                            key={name}
                            field={field}
                            value={data.inputs[name]}
                            onChange={(value) => setInput(name, value)}
                            path={'inputs.' + name}
                            errors={validation.errors}
                            topLevel
                        />
                    ))}
                </CardContent>
            </Card>

            <ProcessOutputSelector
                outputs={schema.outputs}
                selections={outputSelections}
                onChange={(outputs) => setData('outputs', outputs)}
                error={firstOutputError(validation.errors)}
            />

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>{t('jobs.note')}</CardTitle>
                    <CardDescription>
                        {t('jobs.noteDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0">
                    <JobNoteEditor
                        value={data.note}
                        onChange={(note) => setData('note', note)}
                    />
                </CardContent>
            </Card>

            <Button
                type="submit"
                disabled={processing}
                className="w-full sm:w-fit sm:self-end"
            >
                {processing ? (
                    <Spinner data-icon="inline-start" />
                ) : (
                    <PlayIcon data-icon="inline-start" />
                )}
                {t('ogc.execute')}
            </Button>
        </form>
    );
}
