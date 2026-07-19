import { MoveHorizontal, Plus, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';

import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
} from '@/components/ogc/field-validation-feedback';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { htmlPatternForInput } from '@/lib/html-pattern';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import { errorIdForPath, fieldError } from '@/lib/ogc-form-errors';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import { cn } from '@/lib/utils';
import type { OgcNormalizedField } from '@/types';

export default function ArrayTableField({
    field,
    value,
    onChange,
    path,
    validation,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    validation: OgcFieldValidationController;
}) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const errors = validation.errors;
    const rows = Array.isArray(value) ? value : [];
    const columns = field.columns ?? [];
    const tableMinWidth = `${Math.max(columns.length * 8 + 3.5, 32)}rem`;
    const showScrollHint = columns.length > 3;
    const enableDesktopScrollRegion = showScrollHint && !isMobile;
    const scrollHintId = errorIdForPath(path) + '-scroll-hint';
    const label = fieldDisplayLabel(field);
    const structuralError = fieldError(errors, path);
    const structuralState = validation.stateFor(path, structuralError);
    const isRemoveRowDisabled =
        field.minItems !== null &&
        field.minItems !== undefined &&
        rows.length <= field.minItems;

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

    function removeRow(rowIndex: number) {
        validation.resetPathPrefix(path);
        onChange(rows.filter((_, index) => index !== rowIndex));
    }

    return (
        <SectionFieldSet
            label={label}
            description={field.description}
            fieldPath={path}
            error={structuralError}
            validationState={structuralState}
        >
            {enableDesktopScrollRegion ? (
                <p
                    id={scrollHintId}
                    className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"
                >
                    <MoveHorizontal
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                    {t('ogc.arrayTableScrollHint')}
                </p>
            ) : null}
            <Table
                className="block w-full md:table md:min-w-[var(--array-table-min-width)] md:table-fixed"
                containerClassName="overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:overflow-x-auto md:rounded-md md:border md:bg-background"
                containerProps={{
                    role: enableDesktopScrollRegion ? 'region' : undefined,
                    'aria-label': enableDesktopScrollRegion ? label : undefined,
                    'aria-describedby': enableDesktopScrollRegion
                        ? scrollHintId
                        : undefined,
                    tabIndex: enableDesktopScrollRegion ? 0 : undefined,
                    style: {
                        '--array-table-min-width': tableMinWidth,
                    } as CSSProperties,
                }}
            >
                <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead
                                key={column.key}
                                className="w-32 break-words whitespace-normal"
                            >
                                {column.label}
                            </TableHead>
                        ))}
                        <TableHead
                            className="sticky right-0 z-20 w-14 min-w-14 border-l bg-muted text-center shadow-sm"
                            aria-label={t('ogc.removeRow')}
                        />
                    </TableRow>
                </TableHeader>
                <TableBody className="flex flex-col gap-3 md:table-row-group md:gap-0 [&_tr:last-child]:border md:[&_tr:last-child]:border-0">
                    {rows.map((row, rowIndex) => {
                        const rowValues = Array.isArray(row) ? row : [];

                        return (
                            <TableRow
                                key={rowIndex}
                                className="flex flex-col overflow-hidden rounded-md border bg-card shadow-xs md:table-row md:overflow-visible md:rounded-none md:border-x-0 md:border-t-0 md:bg-background md:shadow-none"
                            >
                                <TableCell
                                    data-row-action-layout="mobile"
                                    className="flex items-center justify-between border-b bg-muted/40 p-3 align-top md:hidden"
                                >
                                    <span className="text-sm font-semibold">
                                        {t('ogc.arrayTableRow', {
                                            row: rowIndex + 1,
                                        })}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        aria-label={t('ogc.removeRow')}
                                        disabled={isRemoveRowDisabled}
                                        onClick={() => removeRow(rowIndex)}
                                    >
                                        <Trash2 data-icon="icon" />
                                    </Button>
                                </TableCell>
                                {columns.map((column, columnIndex) => {
                                    const cellPath =
                                        path +
                                        '.' +
                                        rowIndex +
                                        '.' +
                                        columnIndex;
                                    const error = fieldError(errors, cellPath);
                                    const errorId = errorIdForPath(cellPath);
                                    const controlId = errorId + '-control';
                                    const state = validation.stateFor(
                                        cellPath,
                                        error,
                                    );

                                    return (
                                        <TableCell
                                            key={column.key}
                                            className={cn(
                                                'block min-w-0 border-b p-3 align-top whitespace-normal md:table-cell md:border-b-0 md:p-2',
                                                columnIndex ===
                                                    columns.length - 1 &&
                                                    'border-b-0',
                                            )}
                                        >
                                            <Field
                                                className="min-w-0 gap-1.5"
                                                data-invalid={
                                                    state === 'invalid'
                                                        ? true
                                                        : undefined
                                                }
                                            >
                                                <FieldLabel
                                                    htmlFor={controlId}
                                                    className="text-xs font-medium break-words text-muted-foreground md:sr-only"
                                                >
                                                    {column.label}
                                                </FieldLabel>
                                                <OgcValidationControl
                                                    state={state}
                                                    validLabel={
                                                        validation.validLabel
                                                    }
                                                >
                                                    <Input
                                                        id={controlId}
                                                        className={cn(
                                                            'w-full min-w-0',
                                                            ogcValidationControlClassName(
                                                                state,
                                                            ),
                                                        )}
                                                        required={
                                                            column.required
                                                        }
                                                        data-field-path={
                                                            cellPath
                                                        }
                                                        data-validation-state={ogcValidationDataState(
                                                            state,
                                                        )}
                                                        aria-invalid={
                                                            state === 'invalid'
                                                                ? true
                                                                : undefined
                                                        }
                                                        aria-describedby={
                                                            error
                                                                ? errorId
                                                                : undefined
                                                        }
                                                        type={
                                                            column.type ===
                                                                'number' ||
                                                            column.type ===
                                                                'integer'
                                                                ? 'number'
                                                                : 'text'
                                                        }
                                                        value={String(
                                                            rowValues[
                                                                columnIndex
                                                            ] ?? '',
                                                        )}
                                                        step={
                                                            column.type ===
                                                            'number'
                                                                ? 'any'
                                                                : undefined
                                                        }
                                                        min={
                                                            column.minimum ??
                                                            undefined
                                                        }
                                                        max={
                                                            column.maximum ??
                                                            undefined
                                                        }
                                                        data-exclusive-minimum={
                                                            column.exclusiveMinimum ??
                                                            undefined
                                                        }
                                                        data-exclusive-maximum={
                                                            column.exclusiveMaximum ??
                                                            undefined
                                                        }
                                                        pattern={htmlPatternForInput(
                                                            {
                                                                type: column.type,
                                                                pattern:
                                                                    column.pattern,
                                                            },
                                                        )}
                                                        onChange={(event) =>
                                                            updateCell(
                                                                rowIndex,
                                                                columnIndex,
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </OgcValidationControl>
                                                <OgcFieldError
                                                    id={errorId}
                                                    message={error}
                                                    variant="compact"
                                                />
                                            </Field>
                                        </TableCell>
                                    );
                                })}
                                <TableCell
                                    data-row-action-layout="desktop"
                                    className="hidden align-top md:sticky md:right-0 md:z-10 md:table-cell md:w-14 md:min-w-14 md:border-l md:bg-background md:p-2 md:text-center md:shadow-sm"
                                >
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="md:mx-auto"
                                        aria-label={t('ogc.removeRow')}
                                        disabled={isRemoveRowDisabled}
                                        onClick={() => removeRow(rowIndex)}
                                    >
                                        <Trash2 data-icon="icon" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            <Button
                type="button"
                variant="outline"
                className="w-full md:w-auto"
                disabled={
                    field.maxItems !== null &&
                    field.maxItems !== undefined &&
                    rows.length >= field.maxItems
                }
                onClick={() => {
                    validation.fieldChanged(path);
                    onChange([...rows, columns.map(() => '')]);
                }}
            >
                <Plus data-icon="inline-start" />
                {t('ogc.addRow')}
            </Button>
        </SectionFieldSet>
    );
}
