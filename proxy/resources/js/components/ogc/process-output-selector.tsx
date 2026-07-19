import { InfoIcon } from 'lucide-react';

import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationContainerClassName,
    ogcValidationControlClassName,
    ogcValidationDataState,
    ogcValidationFieldClassName,
} from '@/components/ogc/field-validation-feedback';
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
import { errorIdForPath, fieldError } from '@/lib/ogc-form-errors';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import {
    firstOutputError,
    outputFormatKey,
    outputFormatLabel,
    setOutputFormat,
    setOutputSelected,
} from '@/lib/process-output-selection';
import type { ProcessOutputSelections } from '@/lib/process-output-selection';
import { cn } from '@/lib/utils';
import type { OgcNormalizedOutput, OgcOutputFormat } from '@/types';

type ProcessOutputSelectorProps = {
    outputs: Record<string, OgcNormalizedOutput>;
    selections: ProcessOutputSelections;
    onChange: (selections: ProcessOutputSelections) => void;
    validation: OgcFieldValidationController;
};

export default function ProcessOutputSelector({
    outputs,
    selections,
    onChange,
    validation,
}: ProcessOutputSelectorProps) {
    const { t } = useTranslation();
    const errors = validation.errors;
    const hasSelectedOutputs = Object.values(selections).some(
        (selection) => selection.selected,
    );
    const knownOutputHasError = Object.keys(outputs).some((outputId) => {
        const outputPath = 'outputs.' + outputId;

        return Object.entries(errors).some(
            ([path, message]) =>
                Boolean(message) &&
                (path === outputPath || path.startsWith(outputPath + '.')),
        );
    });
    const sectionError =
        fieldError(errors, 'outputs') ??
        (!knownOutputHasError ? firstOutputError(errors) : undefined);
    const sectionErrorId = errorIdForPath('outputs');
    const sectionState = validation.stateFor('outputs', sectionError);

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('ogc.outputs')}</CardTitle>
                <CardDescription>
                    {t('ogc.selectOutputsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent
                className={cn(
                    'flex min-w-0 flex-col gap-4 rounded-b-xl',
                    ogcValidationContainerClassName(sectionState),
                )}
                data-field-path="outputs"
                data-invalid={sectionState === 'invalid' ? true : undefined}
                data-validation-state={ogcValidationDataState(sectionState)}
                tabIndex={-1}
                aria-invalid={sectionState === 'invalid' ? true : undefined}
                aria-describedby={sectionError ? sectionErrorId : undefined}
            >
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
                                validation={validation}
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
                    <Alert className="border-info-emphasis bg-info/10 text-info-emphasis shadow-xs *:data-[slot=alert-description]:text-info-emphasis/80">
                        <InfoIcon />
                        <AlertTitle>{t('ogc.noOutputsSelected')}</AlertTitle>
                        <AlertDescription>
                            {t('ogc.noOutputsSelectedDescription')}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <OgcFieldError id={sectionErrorId} message={sectionError} />
            </CardContent>
        </Card>
    );
}

type OutputSelectionRowProps = {
    outputId: string;
    output: OgcNormalizedOutput;
    selection: ProcessOutputSelections[string];
    validation: OgcFieldValidationController;
    onSelectedChange: (selected: boolean) => void;
    onFormatChange: (format: OgcOutputFormat) => void;
};

function OutputSelectionRow({
    outputId,
    output,
    selection,
    validation,
    onSelectedChange,
    onFormatChange,
}: OutputSelectionRowProps) {
    const { t } = useTranslation();
    const controlId = controlIdForOutput(outputId);
    const formatControlId = controlId + '-format';
    const outputPath = 'outputs.' + outputId;
    const formatPath = outputPath + '.format';
    const outputError = fieldError(validation.errors, outputPath);
    const formatError = Object.entries(validation.errors).find(
        ([path, message]) =>
            Boolean(message) &&
            (path === formatPath || path.startsWith(formatPath + '.')),
    )?.[1];
    const outputErrorId = errorIdForPath(outputPath);
    const formatErrorId = errorIdForPath(formatPath);
    const outputState = validation.stateFor(outputPath, outputError);
    const formatState = validation.stateFor(formatPath, formatError);
    const selectedFormatKey = selection.format
        ? outputFormatKey(selection.format)
        : undefined;

    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <Checkbox
                    id={controlId}
                    className={cn(ogcValidationControlClassName(outputState))}
                    checked={selection.selected}
                    data-field-path={outputPath}
                    data-validation-state={ogcValidationDataState(outputState)}
                    aria-invalid={outputState === 'invalid' ? true : undefined}
                    onCheckedChange={(checked) => {
                        validation.resetPathPrefix(outputPath);
                        validation.fieldChanged('outputs');
                        onSelectedChange(checked === true);
                    }}
                    aria-describedby={
                        [
                            output.description
                                ? controlId + '-description'
                                : null,
                            outputError ? outputErrorId : null,
                        ]
                            .filter((id): id is string => Boolean(id))
                            .join(' ') || undefined
                    }
                />
                <div className="min-w-0">
                    <Label
                        htmlFor={controlId}
                        className={cn(
                            'cursor-pointer break-words',
                            outputState === 'invalid' &&
                                'text-destructive-emphasis',
                        )}
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
                    <OgcFieldError id={outputErrorId} message={outputError} />
                </div>
            </div>

            {output.formats.length > 1 ? (
                <Field
                    className={cn(
                        'min-w-0 sm:w-72',
                        ogcValidationFieldClassName(formatState),
                    )}
                    data-invalid={formatState === 'invalid' ? true : undefined}
                >
                    <FieldLabel htmlFor={formatControlId}>
                        {t('ogc.outputFormat')}
                    </FieldLabel>
                    <OgcValidationControl
                        state={formatState}
                        validLabel={validation.validLabel}
                        hasBuiltInEndIcon
                    >
                        <Select
                            value={selectedFormatKey}
                            disabled={!selection.selected}
                            onValueChange={(key) => {
                                const format = output.formats.find(
                                    (candidate) =>
                                        outputFormatKey(candidate) === key,
                                );

                                if (format) {
                                    validation.resetPathPrefix(formatPath);
                                    onFormatChange(format);
                                }
                            }}
                        >
                            <SelectTrigger
                                id={formatControlId}
                                className={cn(
                                    'w-full min-w-0',
                                    ogcValidationControlClassName(
                                        formatState,
                                        true,
                                    ),
                                )}
                                data-field-path={formatPath}
                                data-validation-state={ogcValidationDataState(
                                    formatState,
                                )}
                                aria-invalid={
                                    formatState === 'invalid' ? true : undefined
                                }
                                aria-describedby={
                                    formatError ? formatErrorId : undefined
                                }
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
                    </OgcValidationControl>
                    <OgcFieldError id={formatErrorId} message={formatError} />
                </Field>
            ) : null}

            {output.formats.length === 1 ? (
                <div
                    className={cn(
                        'min-w-0 rounded-md sm:w-72',
                        ogcValidationContainerClassName(formatState),
                    )}
                    data-field-path={formatPath}
                    data-invalid={formatState === 'invalid' ? true : undefined}
                    data-validation-state={ogcValidationDataState(formatState)}
                    tabIndex={-1}
                    aria-invalid={formatState === 'invalid' ? true : undefined}
                    aria-describedby={formatError ? formatErrorId : undefined}
                >
                    <p className="text-xs font-medium text-muted-foreground">
                        {t('ogc.outputFormat')}
                    </p>
                    <p className="mt-1 text-sm break-words">
                        {outputFormatLabel(output.formats[0])}
                    </p>
                    <OgcFieldError id={formatErrorId} message={formatError} />
                </div>
            ) : null}

            {output.formats.length === 0 && formatError ? (
                <div
                    className={cn(
                        'min-w-0 rounded-md sm:w-72',
                        ogcValidationContainerClassName(formatState),
                    )}
                    data-field-path={formatPath}
                    data-invalid
                    tabIndex={-1}
                    aria-invalid
                    aria-describedby={formatErrorId}
                >
                    <OgcFieldError id={formatErrorId} message={formatError} />
                </div>
            ) : null}
        </div>
    );
}

function controlIdForOutput(outputId: string): string {
    return 'process-output-' + encodeURIComponent(outputId);
}
