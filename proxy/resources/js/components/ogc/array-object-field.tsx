import { Plus, Trash2 } from 'lucide-react';

import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import { fieldError } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
import type { OgcNormalizedField } from '@/types';

export default function ArrayObjectField({
    field,
    value,
    onChange,
    path,
    errors,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    errors: OgcFormErrors;
}) {
    const { t } = useTranslation();
    const rows = Array.isArray(value) ? value : [];

    function updateRow(index: number, row: Record<string, unknown>) {
        onChange(
            rows.map((item, itemIndex) => (itemIndex === index ? row : item)),
        );
    }

    return (
        <SectionFieldSet
            label={fieldDisplayLabel(field)}
            description={field.description}
            fieldPath={path}
            error={fieldError(errors, path)}
        >
            <FieldGroup className="min-w-0">
                {rows.map((row, index) => {
                    const rowValue = isRecord(row) ? row : {};

                    return (
                        <div
                            key={index}
                            className="flex min-w-0 flex-col gap-3 rounded-md border bg-background p-3 dark:bg-background/60"
                        >
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
                                    onClick={() =>
                                        onChange(
                                            rows.filter(
                                                (_, rowIndex) =>
                                                    rowIndex !== index,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 data-icon="icon" />
                                </Button>
                            </div>
                            {Object.entries(field.fields ?? {}).map(
                                ([key, child]) => (
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
                                        errors={errors}
                                    />
                                ),
                            )}
                        </div>
                    );
                })}
            </FieldGroup>
            <Button
                type="button"
                variant="outline"
                disabled={
                    field.maxItems !== null &&
                    field.maxItems !== undefined &&
                    rows.length >= field.maxItems
                }
                onClick={() => onChange([...rows, {}])}
            >
                <Plus data-icon="inline-start" />
                {t('ogc.addRow')}
            </Button>
        </SectionFieldSet>
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
