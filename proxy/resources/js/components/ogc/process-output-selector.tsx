import { InfoIcon } from 'lucide-react';

import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import {
    outputFormatKey,
    outputFormatLabel,
    setOutputFormat,
    setOutputSelected,
} from '@/lib/process-output-selection';
import type { ProcessOutputSelections } from '@/lib/process-output-selection';
import type { OgcNormalizedOutput, OgcOutputFormat } from '@/types';

type ProcessOutputSelectorProps = {
    outputs: Record<string, OgcNormalizedOutput>;
    selections: ProcessOutputSelections;
    onChange: (selections: ProcessOutputSelections) => void;
    error?: string;
};

export default function ProcessOutputSelector({
    outputs,
    selections,
    onChange,
    error,
}: ProcessOutputSelectorProps) {
    const { t } = useTranslation();
    const hasSelectedOutputs = Object.values(selections).some(
        (selection) => selection.selected,
    );

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('ogc.outputs')}</CardTitle>
                <CardDescription>
                    {t('ogc.selectOutputsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4">
                <div className="flex min-w-0 flex-col gap-3">
                    {Object.entries(outputs).map(([outputId, output]) => {
                        const selection = selections[outputId];

                        if (!selection) {
                            return null;
                        }

                        return (
                            <OutputSelectionRow
                                key={outputId}
                                outputId={outputId}
                                output={output}
                                selection={selection}
                                onSelectedChange={(selected) =>
                                    onChange(
                                        setOutputSelected(
                                            selections,
                                            outputId,
                                            selected,
                                        ),
                                    )
                                }
                                onFormatChange={(format) =>
                                    onChange(
                                        setOutputFormat(
                                            selections,
                                            outputId,
                                            format,
                                        ),
                                    )
                                }
                            />
                        );
                    })}
                </div>

                {!hasSelectedOutputs ? (
                    <Alert>
                        <InfoIcon />
                        <AlertTitle>{t('ogc.noOutputsSelected')}</AlertTitle>
                        <AlertDescription>
                            {t('ogc.noOutputsSelectedDescription')}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <InputError message={error} />
            </CardContent>
        </Card>
    );
}

type OutputSelectionRowProps = {
    outputId: string;
    output: OgcNormalizedOutput;
    selection: ProcessOutputSelections[string];
    onSelectedChange: (selected: boolean) => void;
    onFormatChange: (format: OgcOutputFormat) => void;
};

function OutputSelectionRow({
    outputId,
    output,
    selection,
    onSelectedChange,
    onFormatChange,
}: OutputSelectionRowProps) {
    const { t } = useTranslation();
    const controlId = controlIdForOutput(outputId);
    const formatControlId = controlId + '-format';
    const selectedFormatKey = selection.format
        ? outputFormatKey(selection.format)
        : undefined;

    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <Checkbox
                    id={controlId}
                    checked={selection.selected}
                    onCheckedChange={(checked) =>
                        onSelectedChange(checked === true)
                    }
                    aria-describedby={
                        output.description
                            ? controlId + '-description'
                            : undefined
                    }
                />
                <div className="min-w-0">
                    <Label
                        htmlFor={controlId}
                        className="cursor-pointer break-words"
                    >
                        {output.title}
                    </Label>
                    {output.description ? (
                        <p
                            id={controlId + '-description'}
                            className="mt-1 text-sm break-words text-muted-foreground"
                        >
                            {output.description}
                        </p>
                    ) : null}
                </div>
            </div>

            {output.formats.length > 1 ? (
                <Field className="min-w-0 sm:w-72">
                    <FieldLabel htmlFor={formatControlId}>
                        {t('ogc.outputFormat')}
                    </FieldLabel>
                    <Select
                        value={selectedFormatKey}
                        disabled={!selection.selected}
                        onValueChange={(key) => {
                            const format = output.formats.find(
                                (candidate) =>
                                    outputFormatKey(candidate) === key,
                            );

                            if (format) {
                                onFormatChange(format);
                            }
                        }}
                    >
                        <SelectTrigger
                            id={formatControlId}
                            className="w-full min-w-0"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {output.formats.map((format) => (
                                    <SelectItem
                                        key={outputFormatKey(format)}
                                        value={outputFormatKey(format)}
                                    >
                                        {outputFormatLabel(format)}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </Field>
            ) : null}

            {output.formats.length === 1 ? (
                <div className="min-w-0 sm:w-72">
                    <p className="text-xs font-medium text-muted-foreground">
                        {t('ogc.outputFormat')}
                    </p>
                    <p className="mt-1 text-sm break-words">
                        {outputFormatLabel(output.formats[0])}
                    </p>
                </div>
            ) : null}
        </div>
    );
}

function controlIdForOutput(outputId: string): string {
    return 'process-output-' + encodeURIComponent(outputId);
}
