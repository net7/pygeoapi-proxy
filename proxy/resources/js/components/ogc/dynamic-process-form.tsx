import { useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';

import OutputSelector from '@/components/ogc/output-selector';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { store } from '@/routes/processes/executions';
import type { OgcFormSchema, OgcNormalizedField } from '@/types';

type FormData = {
    mode: 'sync' | 'async';
    inputs: Record<string, any>;
    outputs: Record<string, { transmissionMode: string }>;
};

export default function DynamicProcessForm({
    schema,
}: {
    schema: OgcFormSchema;
}) {
    const initialMode = schema.jobControlOptions.includes('sync-execute')
        ? 'sync'
        : 'async';
    const { data, setData, submit, transform, processing, errors } =
        useForm<FormData>({
            mode: initialMode,
            inputs: initialInputValues(schema.fields),
            outputs: Object.fromEntries(
                Object.keys(schema.outputs).map((outputId) => [
                    outputId,
                    { transmissionMode: 'value' },
                ]),
            ),
        });

    function setInput(name: string, value: unknown) {
        setData('inputs', {
            ...data.inputs,
            [name]: value,
        });
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
                submit(store(schema.id));
            }}
        >
            {Object.keys(errors).length > 0 ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        Check the highlighted fields and submit again.
                    </AlertDescription>
                </Alert>
            ) : null}

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Execution Mode</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    <ToggleGroup
                        type="single"
                        value={data.mode}
                        onValueChange={(value) => {
                            if (value === 'sync' || value === 'async') {
                                setData('mode', value);
                            }
                        }}
                    >
                        {schema.jobControlOptions.includes('sync-execute') ? (
                            <ToggleGroupItem value="sync">Sync</ToggleGroupItem>
                        ) : null}
                        {schema.jobControlOptions.includes('async-execute') ? (
                            <ToggleGroupItem value="async">
                                Async
                            </ToggleGroupItem>
                        ) : null}
                    </ToggleGroup>
                </CardContent>
            </Card>

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Inputs</CardTitle>
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

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Outputs</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    <OutputSelector
                        outputs={schema.outputs}
                        value={data.outputs}
                        onChange={(outputs) => setData('outputs', outputs)}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={processing}>
                    {processing ? <Loader2 data-icon="inline-start" /> : null}
                    Execute
                </Button>
            </div>
        </form>
    );
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
