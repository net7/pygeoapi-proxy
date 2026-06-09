import { useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';

import OutputSelector from '@/components/ogc/output-selector';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { store } from '@/routes/processes/executions';
import type { OgcFormSchema } from '@/types';

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
    const { data, setData, submit, processing, errors } = useForm<FormData>({
        mode: initialMode,
        inputs: {},
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
            [name]: normalizeValue(value),
        });
    }

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
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

            <Card>
                <CardHeader>
                    <CardTitle>Execution Mode</CardTitle>
                </CardHeader>
                <CardContent>
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

            <Card>
                <CardHeader>
                    <CardTitle>Inputs</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
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

            <Card>
                <CardHeader>
                    <CardTitle>Outputs</CardTitle>
                </CardHeader>
                <CardContent>
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

function normalizeValue(value: unknown): any {
    if (
        typeof value === 'object' &&
        value !== null &&
        'variant' in value &&
        'value' in value
    ) {
        return toFormValue((value as { value: Record<string, unknown> }).value);
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
