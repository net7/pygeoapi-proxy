import { InfoIcon } from 'lucide-react';

import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationContainerClassName,
    ogcValidationControlClassName,
    ogcValidationDataState,
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
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { errorIdForPath, fieldError } from '@/lib/ogc-form-errors';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import {
    firstOutputError,
    outputFormatAccessibleLabel,
    outputFormatCompactLabel,
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
        <div className="min-w-0 rounded-lg border p-4">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <Checkbox
                    id={controlId}
                    className={ogcValidationControlClassName(outputState)}
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
                <Label
                    htmlFor={controlId}
                    className={cn(
                        'min-w-0 cursor-pointer break-words',
                        outputState === 'invalid' &&
                            'text-destructive-emphasis',
                    )}
                >
                    {output.title}
                </Label>

                {output.formats.length > 1 ? (
                    <div
                        className="col-start-2 row-start-2 ml-auto max-w-full min-w-0 sm:col-start-3 sm:row-start-1"
                        data-invalid={
                            formatState === 'invalid' ? true : undefined
                        }
                        data-disabled={!selection.selected ? true : undefined}
                    >
                        <OgcValidationControl
                            state={formatState}
                            validLabel={validation.validLabel}
                        >
                            <ToggleGroup
                                id={formatControlId}
                                type="single"
                                variant="outline"
                                size="sm"
                                value={selectedFormatKey ?? ''}
                                className={cn(
                                    'w-fit max-w-full justify-start overflow-x-auto',
                                    ogcValidationControlClassName(formatState),
                                )}
                                data-field-path={formatPath}
                                data-validation-state={ogcValidationDataState(
                                    formatState,
                                )}
                                aria-invalid={
                                    formatState === 'invalid' ? true : undefined
                                }
                                aria-label={t('ogc.outputFormat')}
                                aria-describedby={
                                    formatError ? formatErrorId : undefined
                                }
                                disabled={!selection.selected}
                                onValueChange={(key) => {
                                    if (!key) {
                                        return;
                                    }

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
                                {output.formats.map((format) => (
                                    <ToggleGroupItem
                                        key={outputFormatKey(format)}
                                        value={outputFormatKey(format)}
                                        aria-label={outputFormatAccessibleLabel(
                                            format,
                                            output.formats,
                                        )}
                                        className="px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground sm:px-3 sm:text-sm"
                                    >
                                        <span className="sm:hidden">
                                            {outputFormatCompactLabel(
                                                format,
                                                output.formats,
                                            )}
                                        </span>
                                        <span className="hidden sm:inline">
                                            {outputFormatLabel(format)}
                                        </span>
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </OgcValidationControl>
                    </div>
                ) : null}

                {output.formats.length === 1 ? (
                    <span
                        className={cn(
                            'col-start-2 row-start-2 ml-auto max-w-full text-right text-sm font-medium break-all text-muted-foreground sm:col-start-3 sm:row-start-1',
                            ogcValidationContainerClassName(formatState),
                        )}
                        data-field-path={formatPath}
                        data-invalid={
                            formatState === 'invalid' ? true : undefined
                        }
                        data-validation-state={ogcValidationDataState(
                            formatState,
                        )}
                        tabIndex={-1}
                        aria-invalid={
                            formatState === 'invalid' ? true : undefined
                        }
                        aria-label={
                            t('ogc.outputFormat') +
                            ': ' +
                            output.formats[0].mediaType
                        }
                        aria-describedby={
                            formatError ? formatErrorId : undefined
                        }
                    >
                        {output.formats[0].mediaType}
                    </span>
                ) : null}
            </div>

            <div className="mt-3 ml-7 flex min-w-0 flex-col gap-1">
                {output.description ? (
                    <p
                        id={controlId + '-description'}
                        className="text-sm break-words text-muted-foreground"
                    >
                        {output.description}
                    </p>
                ) : null}
                <OgcFieldError id={outputErrorId} message={outputError} />
                {output.formats.length === 0 && formatError ? (
                    <div
                        className={ogcValidationContainerClassName(formatState)}
                        data-field-path={formatPath}
                        data-invalid
                        data-validation-state={ogcValidationDataState(
                            formatState,
                        )}
                        tabIndex={-1}
                        aria-invalid
                        aria-describedby={formatErrorId}
                    >
                        <OgcFieldError
                            id={formatErrorId}
                            message={formatError}
                            variant="compact"
                        />
                    </div>
                ) : (
                    <OgcFieldError
                        id={formatErrorId}
                        message={formatError}
                        variant="compact"
                    />
                )}
            </div>
        </div>
    );
}

function controlIdForOutput(outputId: string): string {
    return 'process-output-' + encodeURIComponent(outputId);
}
