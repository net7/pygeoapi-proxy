# Responsive OGC Array Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere `ArrayTableField` una sequenza di card leggibili su mobile e una tabella accessibile, allineata e scrollabile da `md` in su, senza duplicare i controlli del form.

**Architecture:** Lo stesso albero React conserva un solo `Input` per cella e cambia presentazione con utility Tailwind mobile-first. Il componente `Table` espone attributi e classi opzionali del proprio contenitore di scroll, mentre `OgcFieldError` aggiunge una variante compatta usata soltanto nelle celle dense.

**Tech Stack:** React 19.2, TypeScript 5.9, Tailwind CSS 4.3 (`md` = 48rem / 768px), componenti shadcn locali, Bun test, Vite 8.

## Global Constraints

- Sotto `md`, ogni riga deve essere una card verticale; da `md` in su deve tornare una tabella semantica.
- Deve esistere un solo controllo per ogni percorso di cella: nessun input duplicato o nascosto per supportare i breakpoint.
- Payload, schema normalizzato, regole di validazione e dipendenze devono restare invariati.
- Gli errori restano associati tramite `aria-describedby`; `required`, `data-field-path`, `data-validation-state` e focus del primo errore non cambiano.
- Il contenitore desktop deve avere un solo scroll orizzontale, essere raggiungibile da tastiera e mantenere visibile la colonna azioni.
- I testi devono essere disponibili in italiano e inglese.
- Non modificare altri renderer OGC salvo quanto richiesto dalle interfacce condivise compatibili.

## File Structure

- `resources/js/components/ui/table.tsx`: mantiene il markup tabellare condiviso ed espone `containerClassName` e `containerProps` opzionali.
- `tests/Frontend/table.test.tsx`: verifica che classi e attributi accessibili arrivino al contenitore, non al nodo `<table>`.
- `resources/js/components/ogc/field-validation-feedback.tsx`: aggiunge `variant="compact"` a `OgcFieldError`, preservando il default attuale.
- `tests/Frontend/ogc-field-validation-feedback.test.tsx`: protegge entrambe le varianti del feedback.
- `resources/js/lib/i18n/messages.ts`: aggiunge le copie localizzate per riga e istruzione di scorrimento.
- `tests/Frontend/i18n.test.ts`: verifica interpolazione e parità italiano/inglese delle nuove chiavi.
- `resources/js/components/ogc/array-table-field.tsx`: implementa card mobile, tabella desktop, allineamento superiore, hint, azione sticky e label univoche.
- `tests/Frontend/ogc-array-table-field.test.tsx`: esegue SSR del componente e verifica struttura responsive, unicità dei controlli e wiring accessibile.

---

### Task 1: API accessibile del contenitore tabella

**Files:**
- Create: `tests/Frontend/table.test.tsx`
- Modify: `resources/js/components/ui/table.tsx:1-18`

**Interfaces:**
- Consumes: `cn(...inputs): string` da `resources/js/lib/utils.ts`.
- Produces: `TableProps`, con `containerClassName?: string` e `containerProps?: Omit<React.ComponentProps<'div'>, 'children' | 'className'>`; i consumer esistenti restano compatibili.

- [ ] **Step 1: Scrivere il test fallente del contenitore**

Creare `tests/Frontend/table.test.tsx`:

```tsx
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Table } from '../../resources/js/components/ui/table';

describe('Table', () => {
    test('forwards accessible props and classes to the scroll container', () => {
        const html = renderToStaticMarkup(
            <Table
                containerClassName="focus-visible:ring-2"
                containerProps={{
                    role: 'region',
                    'aria-label': 'Editable data',
                    tabIndex: 0,
                }}
            >
                <tbody>
                    <tr>
                        <td>Value</td>
                    </tr>
                </tbody>
            </Table>,
        );

        expect(html).toContain('data-slot="table-container"');
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="Editable data"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('focus-visible:ring-2');
        expect(html).toContain('overflow-x-auto');
        expect(html).toContain('<table data-slot="table"');
    });
});
```

- [ ] **Step 2: Eseguire il test e confermare il fallimento**

Run:

```bash
bun test tests/Frontend/table.test.tsx
```

Expected: FAIL perché ruolo, nome, `tabindex` e classe di focus non vengono
applicati al contenitore di scroll.

- [ ] **Step 3: Implementare l'API opzionale senza cambiare i consumer esistenti**

Sostituire `resources/js/components/ui/table.tsx` con:

```tsx
import * as React from 'react';

import { cn } from '@/lib/utils';

type TableProps = React.ComponentProps<'table'> & {
    containerClassName?: string;
    containerProps?: Omit<
        React.ComponentProps<'div'>,
        'children' | 'className'
    >;
};

function Table({
    className,
    containerClassName,
    containerProps,
    ...props
}: TableProps) {
    return (
        <div
            {...containerProps}
            data-slot="table-container"
            className={cn(
                'relative w-full overflow-x-auto',
                containerClassName,
            )}
        >
            <table
                data-slot="table"
                className={cn('w-full caption-bottom text-sm', className)}
                {...props}
            />
        </div>
    );
}

function TableHeader({
    className,
    ...props
}: React.ComponentProps<'thead'>) {
    return (
        <thead
            data-slot="table-header"
            className={cn('[&_tr]:border-b', className)}
            {...props}
        />
    );
}

function TableBody({
    className,
    ...props
}: React.ComponentProps<'tbody'>) {
    return (
        <tbody
            data-slot="table-body"
            className={cn('[&_tr:last-child]:border-0', className)}
            {...props}
        />
    );
}

function TableFooter({
    className,
    ...props
}: React.ComponentProps<'tfoot'>) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn(
                'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
                className,
            )}
            {...props}
        />
    );
}

function TableRow({
    className,
    ...props
}: React.ComponentProps<'tr'>) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
                className,
            )}
            {...props}
        />
    );
}

function TableHead({
    className,
    ...props
}: React.ComponentProps<'th'>) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
                className,
            )}
            {...props}
        />
    );
}

function TableCell({
    className,
    ...props
}: React.ComponentProps<'td'>) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
                className,
            )}
            {...props}
        />
    );
}

function TableCaption({
    className,
    ...props
}: React.ComponentProps<'caption'>) {
    return (
        <caption
            data-slot="table-caption"
            className={cn('mt-4 text-sm text-muted-foreground', className)}
            {...props}
        />
    );
}

export {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
};
```

- [ ] **Step 4: Formattare ed eseguire il test**

Run:

```bash
bunx prettier --write resources/js/components/ui/table.tsx tests/Frontend/table.test.tsx
bun test tests/Frontend/table.test.tsx
```

Expected: formatter senza errori; `1 pass`, `0 fail`.

- [ ] **Step 5: Verificare la compatibilità TypeScript**

Run:

```bash
bun run types:check
```

Expected: exit 0 senza errori nei consumer esistenti di `Table`.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/ui/table.tsx tests/Frontend/table.test.tsx
git commit -m "feat: expose accessible table container props"
```

---

### Task 2: Feedback di errore compatto

**Files:**
- Modify: `tests/Frontend/ogc-field-validation-feedback.test.tsx:9-27`
- Modify: `resources/js/components/ogc/field-validation-feedback.tsx:8-29`

**Interfaces:**
- Consumes: `FieldError` e i token semantici distruttivi esistenti.
- Produces: `OgcFieldError({ id?, message?, variant? })`, dove `variant` è `'default' | 'compact'` e vale `'default'` se omesso.

- [ ] **Step 1: Aggiungere il test fallente della variante compatta**

Aggiungere dentro `describe('OGC field validation feedback', ...)` in `tests/Frontend/ogc-field-validation-feedback.test.tsx`:

```tsx
    test('renders a compact error without nested alert chrome', () => {
        const html = renderToStaticMarkup(
            <OgcFieldError
                id="error-inputs-data-0-0"
                message="Complete this field."
                variant="compact"
            />,
        );

        expect(html).toContain('role="alert"');
        expect(html).toContain('error-inputs-data-0-0');
        expect(html).toContain('text-xs');
        expect(html).toContain('leading-snug');
        expect(html).toContain('break-words');
        expect(html).not.toContain('bg-destructive/10');
        expect(html).not.toContain('border-destructive-emphasis');
        expect(html).not.toContain('shadow-xs');
    });
```

- [ ] **Step 2: Eseguire il test e confermare il fallimento**

Run:

```bash
bun test tests/Frontend/ogc-field-validation-feedback.test.tsx
```

Expected: FAIL perché la prop `variant` non esiste e il markup conserva il riquadro predefinito.

- [ ] **Step 3: Implementare la variante preservando il default**

Sostituire la funzione `OgcFieldError` in `resources/js/components/ogc/field-validation-feedback.tsx` con:

```tsx
type OgcFieldErrorVariant = 'default' | 'compact';

export function OgcFieldError({
    id,
    message,
    variant = 'default',
}: {
    id?: string;
    message?: string;
    variant?: OgcFieldErrorVariant;
}) {
    if (!message) {
        return null;
    }

    return (
        <FieldError
            id={id}
            className={cn(
                'flex items-start text-destructive-emphasis [&>svg]:shrink-0',
                variant === 'default'
                    ? 'gap-2 rounded-md border border-destructive-emphasis bg-destructive/10 px-3 py-2 shadow-xs [&>svg]:mt-0.5 [&>svg]:size-4'
                    : 'gap-1.5 text-xs leading-snug [&>svg]:mt-0.5 [&>svg]:size-3.5',
            )}
        >
            <CircleAlertIcon aria-hidden="true" />
            <span className="min-w-0 break-words">{message}</span>
        </FieldError>
    );
}
```

Non modificare `OgcValidationControl` né le funzioni di classe sottostanti.

- [ ] **Step 4: Formattare ed eseguire il test focalizzato**

Run:

```bash
bunx prettier --write resources/js/components/ogc/field-validation-feedback.tsx tests/Frontend/ogc-field-validation-feedback.test.tsx
bun test tests/Frontend/ogc-field-validation-feedback.test.tsx
```

Expected: tutti i test passano; il test preesistente conferma che la variante default conserva bordo, sfondo e colori.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/ogc/field-validation-feedback.tsx tests/Frontend/ogc-field-validation-feedback.test.tsx
git commit -m "feat: add compact OGC field errors"
```

---

### Task 3: Card mobile e tabella desktop nello stesso albero

**Files:**
- Create: `tests/Frontend/ogc-array-table-field.test.tsx`
- Modify: `tests/Frontend/i18n.test.ts:45-70`
- Modify: `resources/js/lib/i18n/messages.ts:340-430,825-895`
- Modify: `resources/js/components/ogc/array-table-field.tsx:1-264`

**Interfaces:**
- Consumes: `Table.containerClassName`, `Table.containerProps`, `OgcFieldError variant="compact"`, `errorIdForPath(path)` e `OgcFieldValidationController` invariato.
- Produces: chiavi `ogc.arrayTableRow` e `ogc.arrayTableScrollHint`; markup con un solo input per `data-field-path`; card sotto `md`; tabella e azione sticky da `md`.

- [ ] **Step 1: Scrivere i test i18n fallenti**

Aggiungere a `tests/Frontend/i18n.test.ts`:

```ts
    test('translates responsive array table controls', () => {
        expect(
            translate('it', 'ogc.arrayTableRow', { row: 2 }),
        ).toBe('Riga 2');
        expect(
            translate('en', 'ogc.arrayTableRow', { row: 2 }),
        ).toBe('Row 2');
        expect(translate('it', 'ogc.arrayTableScrollHint')).toBe(
            'Scorri orizzontalmente per vedere tutte le colonne.',
        );
        expect(translate('en', 'ogc.arrayTableScrollHint')).toBe(
            'Scroll horizontally to view all columns.',
        );
    });
```

- [ ] **Step 2: Scrivere il test SSR fallente del componente**

Creare `tests/Frontend/ogc-array-table-field.test.tsx`:

```tsx
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import ArrayTableField from '../../resources/js/components/ogc/array-table-field';
import type { OgcFieldValidationController } from '../../resources/js/lib/ogc-form-validation';
import type { OgcNormalizedField } from '../../resources/js/types';

const field: OgcNormalizedField = {
    name: 'sw.data',
    title: 'User data',
    description: 'User-defined conditions.',
    kind: 'array_table',
    minItems: 1,
    maxItems: 4,
    columns: [
        {
            key: 'pressure',
            label: 'Pressure',
            type: 'number',
            required: true,
        },
        {
            key: 'temperature',
            label: 'Temperature',
            type: 'number',
            required: true,
        },
        {
            key: 'h2o',
            label: 'H2O',
            type: 'number',
            required: true,
        },
        {
            key: 'co2',
            label: 'CO2',
            type: 'number',
            required: true,
        },
    ],
};

function validationController(): OgcFieldValidationController {
    const errors = {
        'inputs.sw.data.0.1': 'Compila questo campo.',
    };

    return {
        errors,
        validLabel: 'Campo valido',
        stateFor: (_path, error) => (error ? 'invalid' : 'neutral'),
        fieldChanged: () => undefined,
        resetPathPrefix: () => undefined,
        valuesReplaced: () => undefined,
    };
}

function renderField(): string {
    return renderToStaticMarkup(
        <ArrayTableField
            field={field}
            value={[['1000', '', '0.03', '0.01']]}
            onChange={() => undefined}
            path="inputs.sw.data"
            validation={validationController()}
        />,
    );
}

describe('ArrayTableField', () => {
    test('renders one responsive and accessible control tree', () => {
        const html = renderField();

        expect(
            html.match(
                /data-field-path="inputs\.sw\.data\.0\.0"/g,
            ),
        ).toHaveLength(1);
        expect(
            html.match(
                /data-field-path="inputs\.sw\.data\.0\.1"/g,
            ),
        ).toHaveLength(1);
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="User data (sw.data)"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain(
            'aria-describedby="error-inputs-sw-data-scroll-hint"',
        );
        expect(html).toContain('id="error-inputs-sw-data-scroll-hint"');
        expect(html).toContain('Scorri orizzontalmente');
        expect(html).toContain('Riga 1');
        expect(html).toContain(
            'for="error-inputs-sw-data-0-0-control"',
        );
        expect(html).toContain('Pressure');
    });

    test('keeps errors aligned and actions available in both layouts', () => {
        const html = renderField();

        expect(html).toContain('block w-full md:table');
        expect(html).toContain('hidden md:table-header-group');
        expect(html).toContain('flex flex-col');
        expect(html).toContain('md:table-row');
        expect(html).toContain('align-top');
        expect(html).toContain('md:table-cell');
        expect(html).toContain('md:min-w-40');
        expect(html).toContain('break-words');
        expect(html).toContain('order-first');
        expect(html).toContain('md:sticky');
        expect(html).toContain('md:right-0');
        expect(html).toContain('md:sr-only');
        expect(html).toContain(
            'aria-describedby="error-inputs-sw-data-0-1"',
        );
        expect(html).toContain('text-xs');
        expect(html).toContain('w-full md:w-auto');
    });
});
```

- [ ] **Step 3: Eseguire i test e confermare i fallimenti**

Run:

```bash
bun test tests/Frontend/i18n.test.ts tests/Frontend/ogc-array-table-field.test.tsx
```

Expected: FAIL perché le chiavi di traduzione, le props del contenitore, le label mobile e le classi responsive non esistono ancora.

- [ ] **Step 4: Aggiungere le copie italiane e inglesi**

Nel blocco `messages.it.ogc`, subito dopo `addRow`, aggiungere:

```ts
        arrayTableRow: 'Riga {row}',
        arrayTableScrollHint:
            'Scorri orizzontalmente per vedere tutte le colonne.',
```

Nel blocco `messages.en.ogc`, subito dopo `addRow`, aggiungere:

```ts
        arrayTableRow: 'Row {row}',
        arrayTableScrollHint: 'Scroll horizontally to view all columns.',
```

- [ ] **Step 5: Implementare la presentazione responsive**

Sostituire `resources/js/components/ogc/array-table-field.tsx` con:

```tsx
import { MoveHorizontal, Plus, Trash2 } from 'lucide-react';

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
    const errors = validation.errors;
    const rows = Array.isArray(value) ? value : [];
    const columns = field.columns ?? [];
    const showScrollHint = columns.length > 3;
    const scrollHintId = errorIdForPath(path) + '-scroll-hint';
    const label = fieldDisplayLabel(field);
    const structuralError = fieldError(errors, path);
    const structuralState = validation.stateFor(path, structuralError);

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
            label={label}
            description={field.description}
            fieldPath={path}
            error={structuralError}
            validationState={structuralState}
        >
            {showScrollHint ? (
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
                className="block w-full md:table"
                containerClassName="overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:overflow-x-auto md:rounded-md md:border md:bg-background dark:bg-background/60"
                containerProps={{
                    role: showScrollHint ? 'region' : undefined,
                    'aria-label': showScrollHint ? label : undefined,
                    'aria-describedby': showScrollHint
                        ? scrollHintId
                        : undefined,
                    tabIndex: showScrollHint ? 0 : undefined,
                }}
            >
                <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead
                                key={column.key}
                                className="min-w-40 whitespace-normal break-words"
                            >
                                {column.label}
                            </TableHead>
                        ))}
                        <TableHead
                            className="sticky right-0 z-20 w-14 min-w-14 border-l bg-muted/95 text-center shadow-sm"
                            aria-label={t('ogc.removeRow')}
                        />
                    </TableRow>
                </TableHeader>
                <TableBody className="block space-y-3 [&_tr:last-child]:border md:table-row-group md:space-y-0 md:[&_tr:last-child]:border-0">
                    {rows.map((row, rowIndex) => {
                        const rowValues = Array.isArray(row) ? row : [];

                        return (
                            <TableRow
                                key={rowIndex}
                                className="flex flex-col overflow-hidden rounded-md border bg-background shadow-xs md:table-row md:overflow-visible md:rounded-none md:border-x-0 md:border-t-0 md:shadow-none dark:bg-background/60"
                            >
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
                                                'block min-w-0 border-b p-3 align-top whitespace-normal md:table-cell md:min-w-40 md:border-b-0 md:p-2',
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
                                                    className="text-xs font-medium text-muted-foreground break-words md:sr-only"
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
                                <TableCell className="order-first flex items-center justify-between border-b bg-muted/40 p-3 align-top md:sticky md:right-0 md:z-10 md:order-none md:table-cell md:w-14 md:min-w-14 md:border-b-0 md:border-l md:bg-background/95 md:p-2 md:text-center md:shadow-sm">
                                    <span className="text-sm font-semibold md:sr-only">
                                        {t('ogc.arrayTableRow', {
                                            row: rowIndex + 1,
                                        })}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="md:mx-auto"
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
                                                    (_, index) =>
                                                        index !== rowIndex,
                                                ),
                                            );
                                        }}
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
```

- [ ] **Step 6: Formattare e rieseguire i test focalizzati**

Run:

```bash
bunx prettier --write resources/js/components/ogc/array-table-field.tsx resources/js/lib/i18n/messages.ts tests/Frontend/ogc-array-table-field.test.tsx tests/Frontend/i18n.test.ts
bun test tests/Frontend/ogc-array-table-field.test.tsx tests/Frontend/i18n.test.ts tests/Frontend/ogc-field-validation-feedback.test.tsx tests/Frontend/table.test.tsx
```

Expected: tutti i test passano.

- [ ] **Step 7: Eseguire le regressioni di validazione direttamente correlate**

Run:

```bash
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-errors.test.ts tests/Frontend/ogc-form-validation.test.ts
```

Expected: tutti i test passano; il wiring di `required`, focus, reset e stato corretto resta invariato.

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/ogc/array-table-field.tsx resources/js/lib/i18n/messages.ts tests/Frontend/ogc-array-table-field.test.tsx tests/Frontend/i18n.test.ts
git commit -m "feat: make OGC array tables responsive"
```

---

### Task 4: Verifica visuale e quality gate

**Files:**
- Verify: `resources/js/components/ogc/array-table-field.tsx`
- Verify: `resources/js/components/ogc/field-validation-feedback.tsx`
- Verify: `resources/js/components/ui/table.tsx`

**Interfaces:**
- Consumes: applicazione locale `http://localhost:8088/processes` e un processo disponibile che espone `sw.data`.
- Produces: evidenza che breakpoint, scroll, focus e validazione corrispondono ai criteri approvati.

- [ ] **Step 1: Eseguire l'intera suite frontend**

Run:

```bash
bun test tests/Frontend
```

Expected: tutti i test passano, inclusi i nuovi test SSR e le regressioni OGC.

- [ ] **Step 2: Eseguire i controlli statici e la build**

Run:

```bash
bun run types:check
bun run lint:check
bun run build
git diff --check
```

Expected: quattro exit code 0; nessun errore TypeScript/ESLint/Vite e nessun whitespace error.

- [ ] **Step 3: Verificare la card mobile a 375 px**

Usare la skill `playwright` sull'URL risolto da Laravel Boost per `/processes`, aprire un processo che contiene `User data (sw.data)`, impostare viewport 375 px e provocare la validazione con celle obbligatorie vuote.

Expected:

- nessuno scroll orizzontale della pagina o della card;
- una card per riga, con `Riga N` e rimozione nella testata;
- etichetta sopra ogni input ed errore compatto subito sotto;
- `Aggiungi riga` a larghezza piena;
- focus sul primo input invalido visibile.

- [ ] **Step 4: Verificare breakpoint e scroll a 768 px**

Impostare viewport 768 px sulla stessa pagina e mantenere gli errori visibili.

Expected:

- resa tabellare attiva esattamente da `md`;
- un solo contenitore di scroll orizzontale con hint visibile;
- input validi e invalidi allineati sul bordo superiore;
- errori lunghi a capo senza espandere la colonna;
- colonna rimozione sticky sul lato destro.

- [ ] **Step 5: Verificare desktop e tastiera a 1440 px**

Impostare viewport 1440 px, portare il focus con Tab sulla regione tabellare, scorrere orizzontalmente da tastiera e correggere il primo errore.

Expected:

- focus ring visibile sulla regione di scroll;
- intestazioni e campi restano leggibili durante lo scroll;
- azione rimozione resta visibile;
- il campo corretto mostra la spunta verde e perde il messaggio rosso senza disallineare gli altri input.

- [ ] **Step 6: Controllare lo stato finale del repository**

Run:

```bash
git status --short
git log -5 --oneline
```

Expected: worktree pulito; in testa i tre commit delle Task 1-3 preceduti dal commit della specifica e dal commit del piano.
