import { useForm } from '@inertiajs/react';
import { AlertCircleIcon, PlayIcon, WandSparklesIcon } from 'lucide-react';

import InputError from '@/components/input-error';
import ExpectedOutputs from '@/components/ogc/expected-outputs';
import { JobNoteEditor } from '@/components/ogc/job-note-editor';
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
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { markJobsIndexStale } from '@/lib/job-list-refresh';
import { store } from '@/routes/processes/jobs';
import type {
    OgcFormSchema,
    OgcNormalizedField,
    TiptapDocument,
} from '@/types';

type FormData = {
    name: string;
    inputs: Record<string, any>;
    note: TiptapDocument | null;
};

export default function DynamicProcessForm({
    schema,
}: {
    schema: OgcFormSchema;
}) {
    const { t } = useTranslation();
    const { data, setData, submit, transform, processing, errors } =
        useForm<FormData>({
            name: '',
            inputs: initialInputValues(schema.fields),
            note: null,
        });

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
    }

    return (
        <form
            className="flex max-w-full min-w-0 flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                transform((formData) => ({
                    ...formData,
                    inputs: normalizeInputs(schema.fields, formData.inputs),
                }));
                submit(store(schema.id), {
                    onSuccess: () => markJobsIndexStale(),
                });
            }}
        >
            {Object.keys(errors).length > 0 ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{t('ogc.checkInputs')}</AlertTitle>
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
                    <Input
                        id="process-name"
                        value={data.name}
                        onChange={(event) =>
                            setData('name', event.target.value)
                        }
                        placeholder={t('jobs.processNamePlaceholder')}
                        maxLength={255}
                        aria-label={t('jobs.processName')}
                        aria-invalid={Boolean(errors.name)}
                    />
                    <InputError message={errors.name} />
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
                        />
                    ))}
                </CardContent>
            </Card>

            <ExpectedOutputs outputs={schema.outputs} />

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

function exampleInputsToFormValues(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(inputs)
            .filter(([name]) => Boolean(fields[name]))
            .map(([name, value]) => [
                name,
                exampleInputToFormValue(fields[name], value),
            ]),
    );
}

function exampleInputToFormValue(
    field: OgcNormalizedField,
    input: unknown,
): unknown {
    const value = unwrapExampleValue(input);

    if (field.kind === 'oneOf') {
        const objectValue = isRecord(value) ? value : {};
        const variant =
            field.variants?.find((candidate) =>
                Object.keys(objectValue).some((key) =>
                    Object.prototype.hasOwnProperty.call(candidate.fields, key),
                ),
            ) ?? field.variants?.[0];

        if (!variant) {
            return value;
        }

        return {
            variant: variant.id,
            value: objectValue,
        };
    }

    if (field.kind === 'object') {
        return isRecord(value) ? value : {};
    }

    return value;
}

function unwrapExampleValue(value: unknown): unknown {
    if (
        isRecord(value) &&
        Object.prototype.hasOwnProperty.call(value, 'value')
    ) {
        return value.value;
    }

    return value;
}

function initialInputValues(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter(([, value]) => value !== undefined),
    );
}

function defaultFieldValue(field: OgcNormalizedField): unknown {
    if (field.kind === 'enum' && field.options?.length === 1) {
        return field.options[0];
    }

    if (field.kind === 'oneOf') {
        const variant = field.variants?.[0];

        if (!variant) {
            return undefined;
        }

        return {
            variant: variant.id,
            value: defaultObjectValue(variant.fields),
        };
    }

    if (field.kind === 'object' && field.fields) {
        const value = defaultObjectValue(field.fields);

        return Object.keys(value).length > 0 ? value : undefined;
    }

    if (field.kind === 'array_table' && field.minItems && field.minItems > 0) {
        return Array.from({ length: field.minItems }, () =>
            (field.columns ?? []).map(() => ''),
        );
    }

    if (field.kind === 'array_object' && field.minItems && field.minItems > 0) {
        return Array.from({ length: field.minItems }, () =>
            defaultObjectValue(field.fields ?? {}),
        );
    }

    return undefined;
}

function defaultObjectValue(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter(([, value]) => value !== undefined),
    );
}

function normalizeInputs(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, any> {
    return Object.fromEntries(
        Object.entries(inputs).map(([name, value]) => [
            name,
            normalizeValue(value, fields[name]),
        ]),
    );
}

function normalizeValue(value: unknown, field?: OgcNormalizedField): any {
    if (
        typeof value === 'object' &&
        value !== null &&
        'variant' in value &&
        'value' in value
    ) {
        return {
            value: toFormValue(
                (value as { value: Record<string, unknown> }).value,
            ),
        };
    }

    if (field?.kind === 'object') {
        return {
            value: toFormValue(value),
        };
    }

    return toFormValue(value);
}

function toFormValue(value: unknown): any {
    if (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => toFormValue(item));
    }

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                toFormValue(item),
            ]),
        );
    }

    return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
