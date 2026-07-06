import { Plus, Trash2 } from 'lucide-react';

import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { Button } from '@/components/ui/button';
import {
    FieldDescription,
    FieldGroup,
    FieldLegend,
    FieldSet,
} from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import type { OgcNormalizedField } from '@/types';

export default function ArrayObjectField({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const { t } = useTranslation();
    const rows = Array.isArray(value) ? value : [];

    function updateRow(index: number, row: Record<string, unknown>) {
        onChange(
            rows.map((item, itemIndex) => (itemIndex === index ? row : item)),
        );
    }

    return (
        <FieldSet className="max-w-full min-w-0">
            <FieldLegend>{fieldDisplayLabel(field)}</FieldLegend>
            {field.description ? (
                <FieldDescription className="break-words">
                    {field.description}
                </FieldDescription>
            ) : null}
            <FieldGroup className="min-w-0">
                {rows.map((row, index) => {
                    const rowValue = isRecord(row) ? row : {};

                    return (
                        <div
                            key={index}
                            className="flex min-w-0 flex-col gap-3 rounded-md border p-3"
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
        </FieldSet>
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
