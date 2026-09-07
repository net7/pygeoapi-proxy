import { Plus, Trash2 } from 'lucide-react';

import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import { fieldError } from '@/lib/ogc-form-errors';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import { fieldsWithSubmittedValues } from '@/lib/ogc-form-values';
import type { OgcNormalizedField } from '@/types';

export default function ArrayObjectField({
    field,
    value,
    onChange,
    path,
    validation,
    readOnly = false,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    validation: OgcFieldValidationController;
    readOnly?: boolean;
}) {
    const { t } = useTranslation();
    const errors = validation.errors;
    const rows = Array.isArray(value) ? value : [];
    const structuralError = fieldError(errors, path);
    const structuralState = validation.stateFor(path, structuralError);

    function updateRow(index: number, row: Record<string, unknown>) {
        onChange(
            rows.map((item, itemIndex) => (itemIndex === index ? row : item)),
        );
    }

    return (
        <SectionFieldSet
            label={fieldDisplayLabel(field)}
            supportReference={field.name}
            description={field.description}
            fieldPath={path}
            error={structuralError}
            validationState={structuralState}
        >
            <FieldGroup className="min-w-0">
                {rows.map((row, index) => {
                    const rowValue = isRecord(row) ? row : {};

                    return (
                        <div
                            key={index}
                            className="flex min-w-0 flex-col gap-3 rounded-md border bg-background p-3 dark:bg-background/60"
                        >
                            {!readOnly ? (
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        aria-label={t('ogc.removeRow')}
                                        disabled={
                                            field.minItems !== null &&
                                            field.minItems !== undefined &&
                                            rows.length <= field.minItems
                                        }
                                        onClick={() => {
                                            validation.resetPathPrefix(path);
                                            onChange(
                                                rows.filter(
                                                    (_, rowIndex) =>
                                                        rowIndex !== index,
                                                ),
                                            );
                                        }}
                                    >
                                        <Trash2 data-icon="icon" />
                                    </Button>
                                </div>
                            ) : null}
                            {Object.entries(
                                readOnly
                                    ? fieldsWithSubmittedValues(
                                          field.fields ?? {},
                                          rowValue,
                                      )
                                    : (field.fields ?? {}),
                            ).map(([key, child]) => (
                                <SchemaFieldRenderer
                                    key={key}
                                    field={child}
                                    value={rowValue[key]}
                                    onChange={(nextValue) =>
                                        updateRow(index, {
                                            ...rowValue,
                                            [key]: nextValue,
                                        })
                                    }
                                    path={path + '.' + index + '.' + key}
                                    validation={validation}
                                    readOnly={readOnly}
                                />
                            ))}
                        </div>
                    );
                })}
            </FieldGroup>
            {!readOnly ? (
                <Button
                    type="button"
                    variant="outline"
                    disabled={
                        field.maxItems !== null &&
                        field.maxItems !== undefined &&
                        rows.length >= field.maxItems
                    }
                    onClick={() => {
                        validation.fieldChanged(path);
                        onChange([...rows, {}]);
                    }}
                >
                    <Plus data-icon="inline-start" />
                    {t('ogc.addRow')}
                </Button>
            ) : null}
        </SectionFieldSet>
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
