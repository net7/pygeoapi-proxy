import { Plus, Trash2 } from 'lucide-react';

import SectionFieldSet from '@/components/ogc/section-field-set';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { htmlPatternForInput } from '@/lib/html-pattern';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import type { OgcNormalizedField } from '@/types';

export default function ArrayTableField({
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
    const columns = field.columns ?? [];
    const tableMinWidth = `${Math.max(columns.length * 8 + 3, 32)}rem`;

    function updateCell(
        rowIndex: number,
        columnIndex: number,
        cellValue: string,
    ) {
        const nextRows = rows.map((row, currentRowIndex) => {
            const nextRow = Array.isArray(row) ? [...row] : [];

            if (currentRowIndex === rowIndex) {
                nextRow[columnIndex] = cellValue;
            }

            return nextRow;
        });

        onChange(nextRows);
    }

    return (
        <SectionFieldSet
            label={fieldDisplayLabel(field)}
            description={field.description}
        >
            <div className="w-full max-w-full overflow-x-auto rounded-md border bg-background dark:bg-background/60">
                <Table style={{ minWidth: tableMinWidth }}>
                    <TableHeader>
                        <TableRow>
                            {columns.map((column) => (
                                <TableHead key={column.key}>
                                    {column.label}
                                </TableHead>
                            ))}
                            <TableHead className="w-10" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, rowIndex) => {
                            const rowValues = Array.isArray(row) ? row : [];

                            return (
                                <TableRow key={rowIndex}>
                                    {columns.map((column, columnIndex) => (
                                        <TableCell key={column.key}>
                                            <Input
                                                type={
                                                    column.type === 'number' ||
                                                    column.type === 'integer'
                                                        ? 'number'
                                                        : 'text'
                                                }
                                                value={String(
                                                    rowValues[columnIndex] ??
                                                        '',
                                                )}
                                                step={
                                                    column.type === 'number'
                                                        ? 'any'
                                                        : undefined
                                                }
                                                min={
                                                    column.minimum ?? undefined
                                                }
                                                max={
                                                    column.maximum ?? undefined
                                                }
                                                data-exclusive-minimum={
                                                    column.exclusiveMinimum ??
                                                    undefined
                                                }
                                                data-exclusive-maximum={
                                                    column.exclusiveMaximum ??
                                                    undefined
                                                }
                                                pattern={htmlPatternForInput({
                                                    type: column.type,
                                                    pattern: column.pattern,
                                                })}
                                                onChange={(event) =>
                                                    updateCell(
                                                        rowIndex,
                                                        columnIndex,
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell>
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
                                                        (_, index) =>
                                                            index !== rowIndex,
                                                    ),
                                                )
                                            }
                                        >
                                            <Trash2 data-icon="icon" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <Button
                type="button"
                variant="outline"
                disabled={
                    field.maxItems !== null &&
                    field.maxItems !== undefined &&
                    rows.length >= field.maxItems
                }
                onClick={() => onChange([...rows, columns.map(() => '')])}
            >
                <Plus data-icon="inline-start" />
                {t('ogc.addRow')}
            </Button>
        </SectionFieldSet>
    );
}
