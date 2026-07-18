# OGC Process Form Validation Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native browser validation popups in the OGC process execution form with simultaneous accessible inline errors, centered first-error navigation, and a green corrected state that appears only after a client-invalid field becomes valid.

**Architecture:** Keep Inertia `useForm` as the owner of values and server errors. Add a pure validation domain module for native constraint collection and lifecycle transitions, a small React hook that combines that state with dotted Inertia errors, and OGC-scoped shadcn feedback components used by every dynamic field kind. Native controls are validated through the Constraint Validation API; Radix and structural changes explicitly clear only the affected server-error paths.

**Tech Stack:** React 19.2.7, TypeScript 5.9, Inertia React 3.6.1, Tailwind CSS 4.3.3, local shadcn/ui `Field` primitives, Lucide React, Bun test.

## Global Constraints

- Do not add React Hook Form, Zod, or any other dependency.
- Keep backend validation, payload normalization, Wayfinder routes, and submission semantics unchanged.
- Preserve any unrelated pre-existing worktree changes; stage and commit only the exact files listed by each task.
- Scope the new visual treatment to the OGC process execution form; do not change the shared `InputError` component or unrelated forms.
- Use standard localized browser `validationMessage` values for client-detectable constraints.
- A field may become green only after it had a client error and a later user edit makes its native control valid.
- Editing an error known only to the server returns the field to neutral until the next server response.
- Current errors always take precedence over corrected styling.
- Preserve dotted Laravel error paths and exact-path clearing; structural changes may clear only their documented path prefix.
- Keep `scrollIntoView({ behavior: 'smooth', block: 'center' })` followed by `focus({ preventScroll: true })`.
- Use `data-invalid` on shadcn `Field`, `aria-invalid` on controls, path-derived `aria-describedby`, and `FieldError` for inline error semantics.
- Include explicit light/dark destructive and emerald styles.
- Execute with `superpowers:test-driven-development`; invoke `shadcn`, `tailwindcss-development`, `inertia-react-development`, and `playwright` when their task begins.
- Run only frontend tests for code changes in this plan; no PHP file is modified, so Pint is not required.

---

## File Structure

### New files

- `resources/js/lib/ogc-form-validation.ts`
    - Pure native-constraint collection, client-error/corrected lifecycle reducer, error merging, status resolution, and path-prefix helpers.
- `resources/js/hooks/use-ogc-form-validation.ts`
    - React orchestration that combines the pure lifecycle with Inertia errors, exact-path clearing, form-level change handling, submit validation, replacement revalidation, and scheduled focus.
- `resources/js/components/ogc/field-validation-feedback.tsx`
    - OGC-scoped shadcn error box, corrected check icon wrapper, and reusable control/container class helpers.
- `tests/Frontend/ogc-form-validation.test.ts`
    - Pure behavioral tests for native error collection and lifecycle transitions.
- `tests/Frontend/ogc-field-validation-feedback.test.tsx`
    - Server-rendered component tests for accessible error/success markup and styling.
- `tests/Frontend/ogc-validation-wiring.test.ts`
    - Repository-convention source wiring tests covering the hook, root form, and every dynamic field kind.

### Modified files

- `resources/js/lib/ogc-form-errors.ts`
    - Resolve the closest structural target for each error while retaining rendered-order navigation.
- `tests/Frontend/ogc-form-errors.test.ts`
    - Prove deepest-target resolution and exact centered scroll/focus options.
- `resources/js/lib/i18n/messages.ts`
    - Add Italian and English screen-reader text for a corrected field.
- `tests/Frontend/i18n.test.ts`
    - Lock both translations.
- `resources/js/components/ogc/dynamic-process-form.tsx`
    - Add `noValidate`, use the validation hook, gate submission, drive the global alert from combined errors, and pass the controller to fields.
- `resources/js/components/ogc/section-field-set.tsx`
    - Render OGC feedback for structural errors and apply container validation styling.
- `resources/js/components/ogc/schema-field-renderer.tsx`
    - Wire scalar, enum, object, and delegated complex fields to combined errors and visual state.
- `resources/js/components/ogc/one-of-field.tsx`
    - Style selector/structural errors and clear obsolete variant-value paths.
- `resources/js/components/ogc/array-table-field.tsx`
    - Style every cell and clear reindexed paths when rows are removed.
- `resources/js/components/ogc/array-object-field.tsx`
    - Forward the validation controller and clear reindexed paths when rows are removed.
- `resources/js/components/ogc/data-input-field.tsx`
    - Style inline/reference/upload controls and reset stale state when the input mode changes.
- `resources/js/components/ogc/process-output-selector.tsx`
    - Map output and format server errors to their checkbox/select controls and keep an unmapped structural fallback.

---

### Task 1: Build the Pure Validation Domain and Closest-Target Navigation

**Files:**

- Create: `resources/js/lib/ogc-form-validation.ts`
- Create: `tests/Frontend/ogc-form-validation.test.ts`
- Modify: `resources/js/lib/ogc-form-errors.ts`
- Modify: `tests/Frontend/ogc-form-errors.test.ts`

**Interfaces:**

- Produces `OgcFieldValidationState`, `OgcConstraintControl`, `OgcValidationLifecycle`, `OgcValidationAction`, and `OgcFieldValidationController`.
- Produces `collectConstraintErrors`, `collectFormConstraintErrors`, `findConstraintControl`, `renderedFieldPaths`, `isConstraintControl`, `mergeOgcFormErrors`, `ogcFieldValidationState`, `pathMatchesPrefix`, `initialOgcValidationLifecycle`, and `ogcValidationReducer`.
- Keeps the existing `focusFirstInvalidField(form, errors): boolean` signature.

- [ ] **Step 1: Write failing pure-domain tests**

Create `tests/Frontend/ogc-form-validation.test.ts` with focused control doubles and lifecycle expectations:

```ts
import { describe, expect, test } from 'bun:test';

import {
    collectConstraintErrors,
    initialOgcValidationLifecycle,
    mergeOgcFormErrors,
    ogcFieldValidationState,
    ogcValidationReducer,
} from '../../resources/js/lib/ogc-form-validation';
import type { OgcConstraintControl } from '../../resources/js/lib/ogc-form-validation';

function control(
    path: string,
    options: Partial<OgcConstraintControl> = {},
): OgcConstraintControl {
    return {
        dataset: { fieldPath: path },
        isConnected: true,
        hidden: false,
        willValidate: true,
        validationMessage: '',
        getAttribute: () => null,
        checkValidity: () => true,
        ...options,
    };
}

describe('OGC form validation', () => {
    test('collects every active constraint error in rendered order', () => {
        const errors = collectConstraintErrors([
            control('inputs.first', {
                validationMessage: 'Complete this field.',
                checkValidity: () => false,
            }),
            control('inputs.second', {
                validationMessage: 'Enter a number.',
                checkValidity: () => false,
            }),
        ]);

        expect(errors).toEqual({
            'inputs.first': 'Complete this field.',
            'inputs.second': 'Enter a number.',
        });
    });

    test('keeps the first message for duplicate paths', () => {
        const errors = collectConstraintErrors([
            control('inputs.reference', {
                validationMessage: 'Enter a URL.',
                checkValidity: () => false,
            }),
            control('inputs.reference', {
                validationMessage: 'Ignore this duplicate.',
                checkValidity: () => false,
            }),
        ]);

        expect(errors).toEqual({
            'inputs.reference': 'Enter a URL.',
        });
    });

    test('ignores valid, hidden, disabled, disconnected, and aria-hidden controls', () => {
        expect(
            collectConstraintErrors([
                control('inputs.valid'),
                control('inputs.hidden', {
                    hidden: true,
                    validationMessage: 'Hidden',
                    checkValidity: () => false,
                }),
                control('inputs.disabled', {
                    willValidate: false,
                    validationMessage: 'Disabled',
                    checkValidity: () => false,
                }),
                control('inputs.disconnected', {
                    isConnected: false,
                    validationMessage: 'Disconnected',
                    checkValidity: () => false,
                }),
                control('inputs.ariaHidden', {
                    validationMessage: 'Aria hidden',
                    getAttribute: (name) =>
                        name === 'aria-hidden' ? 'true' : null,
                    checkValidity: () => false,
                }),
            ]),
        ).toEqual({});
    });

    test('lets server errors override client messages on the same path', () => {
        expect(
            mergeOgcFormErrors(
                { 'inputs.value': 'Browser message.' },
                { 'inputs.value': 'Server message.', name: 'Name error.' },
            ),
        ).toEqual({
            'inputs.value': 'Server message.',
            name: 'Name error.',
        });
    });

    test('marks only a previously client-invalid field corrected', () => {
        const invalid = ogcValidationReducer(initialOgcValidationLifecycle, {
            type: 'submitted',
            errors: { 'inputs.value': 'Complete this field.' },
            activePaths: ['inputs.value', 'inputs.untouched'],
        });
        const corrected = ogcValidationReducer(invalid, {
            type: 'field-corrected',
            path: 'inputs.value',
        });
        const untouched = ogcValidationReducer(corrected, {
            type: 'field-corrected',
            path: 'inputs.untouched',
        });

        expect(
            ogcFieldValidationState(
                'inputs.value',
                corrected.clientErrors,
                corrected.correctedPaths,
            ),
        ).toBe('corrected');
        expect(
            ogcFieldValidationState(
                'inputs.untouched',
                untouched.clientErrors,
                untouched.correctedPaths,
            ),
        ).toBe('neutral');
    });

    test('a fresh error overrides corrected state', () => {
        const corrected = {
            clientErrors: {},
            correctedPaths: new Set(['inputs.value']),
        };
        const invalid = ogcValidationReducer(corrected, {
            type: 'field-invalid',
            path: 'inputs.value',
            message: 'Enter a number.',
        });

        expect(
            ogcFieldValidationState(
                'inputs.value',
                invalid.clientErrors,
                invalid.correctedPaths,
            ),
        ).toBe('invalid');
    });

    test('prefix reset removes reindexed and unmounted state only', () => {
        const state = {
            clientErrors: {
                'inputs.rows.0.value': 'First row.',
                'inputs.other': 'Other field.',
            },
            correctedPaths: new Set([
                'inputs.rows.1.value',
                'inputs.otherCorrected',
            ]),
        };

        expect(
            ogcValidationReducer(state, {
                type: 'reset-prefix',
                prefix: 'inputs.rows',
            }),
        ).toEqual({
            clientErrors: { 'inputs.other': 'Other field.' },
            correctedPaths: new Set(['inputs.otherCorrected']),
        });
    });
});
```

- [ ] **Step 2: Add failing closest-target and scroll assertions**

Extend `tests/Frontend/ogc-form-errors.test.ts` by importing `mock` and `focusFirstInvalidField`, then add:

```ts
import { describe, expect, mock, test } from 'bun:test';

test('chooses the deepest structural target for a nested error', () => {
    const controls = ['outputs', 'outputs.chart', 'outputs.chart.format'];
    const errors = {
        'outputs.chart.format.mediaType': 'Format is invalid.',
    };

    expect(firstInvalidFieldPath(controls, errors)).toBe(
        'outputs.chart.format',
    );
});

test('centers and focuses the first invalid control without a second scroll', () => {
    const scrollIntoView = mock(() => undefined);
    const focus = mock(() => undefined);
    const target = {
        dataset: { fieldPath: 'inputs.value' },
        scrollIntoView,
        focus,
    } as unknown as HTMLElement;
    const form = {
        querySelectorAll: () => [target],
    } as unknown as HTMLFormElement;

    expect(
        focusFirstInvalidField(form, {
            'inputs.value': 'Complete this field.',
        }),
    ).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
bun test tests/Frontend/ogc-form-validation.test.ts tests/Frontend/ogc-form-errors.test.ts
```

Expected: FAIL because `ogc-form-validation.ts` does not exist and the current structural fallback chooses `outputs` instead of `outputs.chart.format`.

- [ ] **Step 4: Implement the pure validation module**

Create `resources/js/lib/ogc-form-validation.ts`:

```ts
import { fieldError } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';

export type OgcFieldValidationState = 'neutral' | 'invalid' | 'corrected';

export type OgcConstraintControl = {
    dataset: { fieldPath?: string };
    isConnected: boolean;
    hidden: boolean;
    willValidate: boolean;
    validationMessage: string;
    getAttribute: (name: string) => string | null;
    checkValidity: () => boolean;
};

export type OgcValidationLifecycle = {
    clientErrors: OgcFormErrors;
    correctedPaths: ReadonlySet<string>;
};

export type OgcValidationAction =
    | {
          type: 'submitted';
          errors: OgcFormErrors;
          activePaths: string[];
      }
    | { type: 'field-invalid'; path: string; message: string }
    | { type: 'field-corrected'; path: string }
    | { type: 'reset-prefix'; prefix: string };

export type OgcFieldValidationController = {
    errors: OgcFormErrors;
    validLabel: string;
    stateFor: (path: string, renderedError?: string) => OgcFieldValidationState;
    fieldChanged: (path: string, control?: OgcConstraintControl | null) => void;
    resetPathPrefix: (prefix: string) => void;
    valuesReplaced: (prefix: string) => void;
};

export const initialOgcValidationLifecycle: OgcValidationLifecycle = {
    clientErrors: {},
    correctedPaths: new Set<string>(),
};

export function collectConstraintErrors(
    controls: Iterable<OgcConstraintControl>,
): OgcFormErrors {
    const errors: OgcFormErrors = {};

    for (const control of controls) {
        const path = control.dataset.fieldPath;

        if (
            !path ||
            !isActiveConstraintControl(control) ||
            control.checkValidity() ||
            !control.validationMessage
        ) {
            continue;
        }

        errors[path] ??= control.validationMessage;
    }

    return errors;
}

export function collectFormConstraintErrors(
    form: HTMLFormElement | null,
): OgcFormErrors {
    if (!form) {
        return {};
    }

    return collectConstraintErrors(
        Array.from(form.querySelectorAll('[data-field-path]')).filter(
            isConstraintControl,
        ),
    );
}

export function renderedFieldPaths(form: HTMLFormElement | null): string[] {
    if (!form) {
        return [];
    }

    return Array.from(form.querySelectorAll<HTMLElement>('[data-field-path]'))
        .filter(
            (target) =>
                target.isConnected &&
                !target.hidden &&
                target.getAttribute('aria-hidden') !== 'true',
        )
        .map((target) => target.dataset.fieldPath)
        .filter((path): path is string => Boolean(path));
}

export function findConstraintControl(
    form: HTMLFormElement | null,
    path: string,
): OgcConstraintControl | null {
    if (!form) {
        return null;
    }

    return (
        Array.from(form.querySelectorAll('[data-field-path]'))
            .filter(isConstraintControl)
            .find(
                (control) =>
                    control.dataset.fieldPath === path &&
                    isActiveConstraintControl(control),
            ) ?? null
    );
}

export function isConstraintControl(
    value: unknown,
): value is OgcConstraintControl {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'dataset' in value &&
        'isConnected' in value &&
        'hidden' in value &&
        'willValidate' in value &&
        'validationMessage' in value &&
        'getAttribute' in value &&
        typeof value.getAttribute === 'function' &&
        'checkValidity' in value &&
        typeof value.checkValidity === 'function',
    );
}

export function mergeOgcFormErrors(
    clientErrors: OgcFormErrors,
    serverErrors: OgcFormErrors,
): OgcFormErrors {
    return Object.fromEntries(
        [
            ...Object.entries(clientErrors),
            ...Object.entries(serverErrors),
        ].filter(
            (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && entry[1].length > 0,
        ),
    );
}

export function ogcFieldValidationState(
    path: string,
    errors: OgcFormErrors,
    correctedPaths: ReadonlySet<string>,
): OgcFieldValidationState {
    if (fieldError(errors, path)) {
        return 'invalid';
    }

    return correctedPaths.has(path) ? 'corrected' : 'neutral';
}

export function pathMatchesPrefix(path: string, prefix: string): boolean {
    return path === prefix || path.startsWith(prefix + '.');
}

export function ogcValidationReducer(
    state: OgcValidationLifecycle,
    action: OgcValidationAction,
): OgcValidationLifecycle {
    if (action.type === 'submitted') {
        const activePaths = new Set(action.activePaths);
        const correctedPaths = new Set(
            [...state.correctedPaths].filter(
                (path) =>
                    activePaths.has(path) && !fieldError(action.errors, path),
            ),
        );

        return {
            clientErrors: action.errors,
            correctedPaths,
        };
    }

    if (action.type === 'field-invalid') {
        const correctedPaths = new Set(state.correctedPaths);
        correctedPaths.delete(action.path);

        return {
            clientErrors: {
                ...state.clientErrors,
                [action.path]: action.message,
            },
            correctedPaths,
        };
    }

    if (action.type === 'field-corrected') {
        if (!fieldError(state.clientErrors, action.path)) {
            return state;
        }

        const clientErrors = { ...state.clientErrors };
        delete clientErrors[action.path];
        const correctedPaths = new Set(state.correctedPaths);
        correctedPaths.add(action.path);

        return { clientErrors, correctedPaths };
    }

    const clientErrors = Object.fromEntries(
        Object.entries(state.clientErrors).filter(
            ([path]) => !pathMatchesPrefix(path, action.prefix),
        ),
    );
    const correctedPaths = new Set(
        [...state.correctedPaths].filter(
            (path) => !pathMatchesPrefix(path, action.prefix),
        ),
    );

    return { clientErrors, correctedPaths };
}

function isActiveConstraintControl(control: OgcConstraintControl): boolean {
    return (
        control.isConnected &&
        !control.hidden &&
        control.willValidate &&
        control.getAttribute('aria-hidden') !== 'true'
    );
}
```

- [ ] **Step 5: Update closest-target resolution**

Replace `firstInvalidFieldPath` in `resources/js/lib/ogc-form-errors.ts` with:

```ts
export function firstInvalidFieldPath(
    controlPaths: string[],
    errors: OgcFormErrors,
): string | null {
    const errorPaths = Object.entries(errors)
        .filter(
            (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && entry[1].length > 0,
        )
        .map(([path]) => path);
    const resolvedTargets = new Set<string>();

    for (const errorPath of errorPaths) {
        const closest = controlPaths
            .filter(
                (controlPath) =>
                    errorPath === controlPath ||
                    errorPath.startsWith(controlPath + '.'),
            )
            .sort((left, right) => right.length - left.length)[0];

        if (closest) {
            resolvedTargets.add(closest);
        }
    }

    return controlPaths.find((path) => resolvedTargets.has(path)) ?? null;
}
```

Do not change `focusFirstInvalidField`; the new test locks its existing centered behavior.

- [ ] **Step 6: Format and verify GREEN**

Run:

```bash
bunx prettier --write resources/js/lib/ogc-form-validation.ts resources/js/lib/ogc-form-errors.ts tests/Frontend/ogc-form-validation.test.ts tests/Frontend/ogc-form-errors.test.ts
bun test tests/Frontend/ogc-form-validation.test.ts tests/Frontend/ogc-form-errors.test.ts
bun run types:check
```

Expected: all focused tests pass and TypeScript exits with code 0.

- [ ] **Step 7: Commit the pure domain**

```bash
git add resources/js/lib/ogc-form-validation.ts resources/js/lib/ogc-form-errors.ts tests/Frontend/ogc-form-validation.test.ts tests/Frontend/ogc-form-errors.test.ts
git commit -m "feat: add OGC form validation state"
```

---

### Task 2: Add OGC-Scoped Shadcn Error and Corrected Feedback

**Files:**

- Create: `resources/js/components/ogc/field-validation-feedback.tsx`
- Create: `tests/Frontend/ogc-field-validation-feedback.test.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`
- Modify: `tests/Frontend/i18n.test.ts`

**Interfaces:**

- Produces `OgcFieldError`, `OgcValidationControl`, `ogcValidationControlClassName`, `ogcValidationContainerClassName`, and `ogcValidationDataState`.
- Consumes `OgcFieldValidationState` from Task 1.

- [ ] **Step 1: Write failing feedback and translation tests**

Create `tests/Frontend/ogc-field-validation-feedback.test.tsx`:

```tsx
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
} from '../../resources/js/components/ogc/field-validation-feedback';

describe('OGC field validation feedback', () => {
    test('renders an accessible destructive error box', () => {
        const html = renderToStaticMarkup(
            <OgcFieldError
                id="error-inputs-value"
                message="Complete this field."
            />,
        );

        expect(html).toContain('role="alert"');
        expect(html).toContain('error-inputs-value');
        expect(html).toContain('Complete this field.');
        expect(html).toContain('bg-destructive/10');
        expect(html).toContain('dark:bg-red-950/50');
    });

    test('renders a corrected status only for corrected fields', () => {
        const html = renderToStaticMarkup(
            <OgcValidationControl state="corrected" validLabel="Campo valido">
                <input />
            </OgcValidationControl>,
        );

        expect(html).toContain('role="status"');
        expect(html).toContain('Campo valido');
        expect(html).toContain('text-emerald-600');
        expect(
            renderToStaticMarkup(
                <OgcValidationControl state="neutral" validLabel="Campo valido">
                    <input />
                </OgcValidationControl>,
            ),
        ).not.toContain('role="status"');
    });

    test('returns persistent red and green border-ring classes', () => {
        expect(ogcValidationControlClassName('invalid')).toContain(
            'ring-destructive/20',
        );
        expect(ogcValidationControlClassName('corrected')).toContain(
            'ring-emerald-500/20',
        );
        expect(ogcValidationDataState('corrected')).toBe('valid');
        expect(ogcValidationDataState('neutral')).toBeUndefined();
    });
});
```

Add to the translation test in `tests/Frontend/i18n.test.ts`:

```ts
test('translates corrected OGC field status', () => {
    expect(translate('it', 'ogc.fieldValid')).toBe('Campo valido');
    expect(translate('en', 'ogc.fieldValid')).toBe('Field is valid');
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
bun test tests/Frontend/ogc-field-validation-feedback.test.tsx tests/Frontend/i18n.test.ts
```

Expected: FAIL because the feedback component and `ogc.fieldValid` messages do not exist.

- [ ] **Step 3: Implement the feedback component**

Create `resources/js/components/ogc/field-validation-feedback.tsx`:

```tsx
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { FieldError } from '@/components/ui/field';
import type { OgcFieldValidationState } from '@/lib/ogc-form-validation';
import { cn } from '@/lib/utils';

export function OgcFieldError({
    id,
    message,
}: {
    id?: string;
    message?: string;
}) {
    if (!message) {
        return null;
    }

    return (
        <FieldError
            id={id}
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive dark:border-red-400/30 dark:bg-red-950/50 dark:text-red-300"
        >
            <CircleAlertIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0 break-words">{message}</span>
        </FieldError>
    );
}

export function OgcValidationControl({
    state,
    validLabel,
    hasBuiltInEndIcon = false,
    children,
}: {
    state: OgcFieldValidationState;
    validLabel: string;
    hasBuiltInEndIcon?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="relative min-w-0">
            {children}
            {state === 'corrected' ? (
                <span
                    role="status"
                    className={cn(
                        'pointer-events-none absolute top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400',
                        hasBuiltInEndIcon ? 'right-9' : 'right-3',
                    )}
                >
                    <CircleCheckIcon aria-hidden="true" className="size-4" />
                    <span className="sr-only">{validLabel}</span>
                </span>
            ) : null}
        </div>
    );
}

export function ogcValidationControlClassName(
    state: OgcFieldValidationState,
    hasBuiltInEndIcon = false,
): string | undefined {
    return cn(
        state === 'invalid' &&
            'border-destructive ring-[3px] ring-destructive/20 dark:ring-destructive/40',
        state === 'corrected' && [
            'border-emerald-500 ring-[3px] ring-emerald-500/20 focus-visible:border-emerald-600 focus-visible:ring-emerald-500/30',
            'dark:border-emerald-400 dark:ring-emerald-400/30 dark:focus-visible:border-emerald-300 dark:focus-visible:ring-emerald-400/40',
            hasBuiltInEndIcon ? 'pr-14' : 'pr-10',
        ],
    );
}

export function ogcValidationContainerClassName(
    state: OgcFieldValidationState,
): string | undefined {
    return cn(
        state === 'invalid' &&
            'border-destructive ring-[3px] ring-destructive/20 dark:ring-destructive/40',
        state === 'corrected' &&
            'border-emerald-500 ring-[3px] ring-emerald-500/20 dark:border-emerald-400 dark:ring-emerald-400/30',
    );
}

export function ogcValidationDataState(
    state: OgcFieldValidationState,
): 'valid' | undefined {
    return state === 'corrected' ? 'valid' : undefined;
}
```

- [ ] **Step 4: Add both translations**

In the Italian `ogc` object in `resources/js/lib/i18n/messages.ts`, add:

```ts
fieldValid: 'Campo valido',
```

In the English `ogc` object, add:

```ts
fieldValid: 'Field is valid',
```

- [ ] **Step 5: Format and verify GREEN**

```bash
bunx prettier --write resources/js/components/ogc/field-validation-feedback.tsx resources/js/lib/i18n/messages.ts tests/Frontend/ogc-field-validation-feedback.test.tsx tests/Frontend/i18n.test.ts
bun test tests/Frontend/ogc-field-validation-feedback.test.tsx tests/Frontend/i18n.test.ts
bun run types:check
```

Expected: feedback and translation tests pass; TypeScript exits with code 0.

- [ ] **Step 6: Commit the visual primitives**

```bash
git add resources/js/components/ogc/field-validation-feedback.tsx resources/js/lib/i18n/messages.ts tests/Frontend/ogc-field-validation-feedback.test.tsx tests/Frontend/i18n.test.ts
git commit -m "feat: add OGC field validation feedback"
```

---

### Task 3: Orchestrate Native and Inertia Errors at the Root Form

**Files:**

- Create: `resources/js/hooks/use-ogc-form-validation.ts`
- Create: `tests/Frontend/ogc-validation-wiring.test.ts`
- Modify: `resources/js/components/ogc/dynamic-process-form.tsx`

**Interfaces:**

- Consumes Task 1's pure domain and Task 2's visual feedback.
- Produces `UseOgcFormValidationResult`, which implements the controller (including `valuesReplaced`) and adds root-only `handleFormChange`, `validateForm`, and `focusErrors` methods.
- Keeps Inertia's existing `transform` and `submit(store(schema.id), options)` flow.

- [ ] **Step 1: Write the failing root wiring test**

Create `tests/Frontend/ogc-validation-wiring.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

function source(path: string): string {
    return readFileSync(path, 'utf8');
}

describe('OGC validation wiring', () => {
    test('gates the Inertia submit with all native constraint errors', () => {
        const form = source(
            'resources/js/components/ogc/dynamic-process-form.tsx',
        );

        expect(form).toContain('useOgcFormValidation');
        expect(form).toContain('noValidate');
        expect(form).toContain('onChangeCapture={validation.handleFormChange}');
        expect(form).toContain('if (!validation.validateForm())');
        expect(form).toContain('validation.focusErrors');
        expect(form).toContain('validation.errors');
    });

    test('clears exact server paths and revalidates only prior client errors', () => {
        const hook = source('resources/js/hooks/use-ogc-form-validation.ts');

        expect(hook).toContain('clearServerErrors(path)');
        expect(hook).toContain('lifecycle.clientErrors');
        expect(hook).toContain("type: 'field-corrected'");
        expect(hook).toContain('collectFormConstraintErrors');
        expect(hook).toContain('requestAnimationFrame');
    });
});
```

- [ ] **Step 2: Run the wiring test and verify RED**

```bash
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-errors.test.ts
```

Expected: FAIL because the hook does not exist and the root form still relies on browser popups.

- [ ] **Step 3: Implement the validation hook**

Create `resources/js/hooks/use-ogc-form-validation.ts`:

```ts
import type { FormEvent, RefObject } from 'react';
import { useCallback, useMemo, useReducer } from 'react';

import {
    collectFormConstraintErrors,
    findConstraintControl,
    initialOgcValidationLifecycle,
    isConstraintControl,
    mergeOgcFormErrors,
    ogcFieldValidationState,
    ogcValidationReducer,
    pathMatchesPrefix,
    renderedFieldPaths,
} from '@/lib/ogc-form-validation';
import type {
    OgcConstraintControl,
    OgcFieldValidationController,
    OgcFieldValidationState,
} from '@/lib/ogc-form-validation';
import { fieldError, focusFirstInvalidField } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';

type UseOgcFormValidationOptions = {
    formRef: RefObject<HTMLFormElement | null>;
    serverErrors: OgcFormErrors;
    clearServerErrors: (...paths: string[]) => void;
    validLabel: string;
};

export type UseOgcFormValidationResult = OgcFieldValidationController & {
    handleFormChange: (event: FormEvent<HTMLFormElement>) => void;
    validateForm: () => boolean;
    focusErrors: (errors: OgcFormErrors) => void;
};

export function useOgcFormValidation({
    formRef,
    serverErrors,
    clearServerErrors,
    validLabel,
}: UseOgcFormValidationOptions): UseOgcFormValidationResult {
    const [lifecycle, dispatch] = useReducer(
        ogcValidationReducer,
        initialOgcValidationLifecycle,
    );
    const errors = useMemo(
        () => mergeOgcFormErrors(lifecycle.clientErrors, serverErrors),
        [lifecycle.clientErrors, serverErrors],
    );

    const clearServerErrorsForPrefix = useCallback(
        (prefix: string): void => {
            const paths = Object.entries(serverErrors)
                .filter(
                    (entry): entry is [string, string] =>
                        typeof entry[1] === 'string' &&
                        entry[1].length > 0 &&
                        pathMatchesPrefix(entry[0], prefix),
                )
                .map(([path]) => path);

            if (paths.length > 0) {
                clearServerErrors(...paths);
            }
        },
        [clearServerErrors, serverErrors],
    );

    const focusErrors = useCallback(
        (nextErrors: OgcFormErrors): void => {
            window.requestAnimationFrame(() => {
                focusFirstInvalidField(formRef.current, nextErrors);
            });
        },
        [formRef],
    );

    const fieldChanged = useCallback(
        (
            path: string,
            suppliedControl: OgcConstraintControl | null = null,
        ): void => {
            if (fieldError(serverErrors, path)) {
                clearServerErrors(path);
            }

            if (!fieldError(lifecycle.clientErrors, path)) {
                return;
            }

            const control =
                suppliedControl ?? findConstraintControl(formRef.current, path);

            if (!control) {
                dispatch({ type: 'reset-prefix', prefix: path });

                return;
            }

            if (control.checkValidity()) {
                dispatch({ type: 'field-corrected', path });

                return;
            }

            dispatch({
                type: 'field-invalid',
                path,
                message:
                    control.validationMessage ||
                    lifecycle.clientErrors[path] ||
                    '',
            });
        },
        [clearServerErrors, formRef, lifecycle.clientErrors, serverErrors],
    );

    const resetPathPrefix = useCallback(
        (prefix: string): void => {
            dispatch({ type: 'reset-prefix', prefix });
            clearServerErrorsForPrefix(prefix);
        },
        [clearServerErrorsForPrefix],
    );

    const handleFormChange = useCallback(
        (event: FormEvent<HTMLFormElement>): void => {
            const control = isConstraintControl(event.target)
                ? event.target
                : null;
            const path = control?.dataset.fieldPath;

            if (path) {
                fieldChanged(path, control);
            }
        },
        [fieldChanged],
    );

    const validateForm = useCallback((): boolean => {
        const nextClientErrors = collectFormConstraintErrors(formRef.current);

        dispatch({
            type: 'submitted',
            errors: nextClientErrors,
            activePaths: renderedFieldPaths(formRef.current),
        });

        if (Object.keys(nextClientErrors).length === 0) {
            return true;
        }

        focusErrors(mergeOgcFormErrors(nextClientErrors, serverErrors));

        return false;
    }, [focusErrors, formRef, serverErrors]);

    const valuesReplaced = useCallback(
        (prefix: string): void => {
            clearServerErrorsForPrefix(prefix);
            const paths = Object.keys(lifecycle.clientErrors).filter((path) =>
                pathMatchesPrefix(path, prefix),
            );

            window.requestAnimationFrame(() => {
                for (const path of paths) {
                    fieldChanged(path);
                }
            });
        },
        [clearServerErrorsForPrefix, fieldChanged, lifecycle.clientErrors],
    );

    const stateFor = useCallback(
        (path: string, renderedError?: string): OgcFieldValidationState => {
            if (renderedError) {
                return 'invalid';
            }

            return ogcFieldValidationState(
                path,
                errors,
                lifecycle.correctedPaths,
            );
        },
        [errors, lifecycle.correctedPaths],
    );

    return {
        errors,
        validLabel,
        stateFor,
        fieldChanged,
        resetPathPrefix,
        handleFormChange,
        validateForm,
        focusErrors,
        valuesReplaced,
    };
}
```

- [ ] **Step 4: Integrate the hook at the root form without changing child contracts yet**

In `resources/js/components/ogc/dynamic-process-form.tsx`:

1. Import `OgcFieldError`, `OgcValidationControl`, the validation class/data helpers, shadcn `Field`, `useOgcFormValidation`, `fieldError`, and `cn`.
2. Destructure `clearErrors` from Inertia `useForm`.
3. Build the hook immediately after `fieldErrors`:

```tsx
const validation = useOgcFormValidation({
    formRef,
    serverErrors: fieldErrors,
    clearServerErrors: clearErrors as (...paths: string[]) => void,
    validLabel: t('ogc.fieldValid'),
});
const nameError = fieldError(validation.errors, 'name');
const nameState = validation.stateFor('name', nameError);
```

4. After setting example values, call:

```tsx
validation.valuesReplaced('inputs');
```

5. Add these form props:

```tsx
noValidate
onChangeCapture={validation.handleFormChange}
```

6. At the start of `onSubmit`, after `event.preventDefault()`, gate the existing transform/submit flow:

```tsx
if (!validation.validateForm()) {
    return;
}
```

7. Replace the current `requestAnimationFrame` body in `onError` with:

```tsx
validation.focusErrors(nextErrors as OgcFormErrors);
```

8. Drive the global alert from `validation.errors`, pass `validation.errors` through the existing `errors` props temporarily, and pass it to `firstOutputError`.
9. Replace the process-name input/error block with:

```tsx
<Field
    className="min-w-0 gap-2"
    data-invalid={nameState === 'invalid' ? true : undefined}
>
    <OgcValidationControl state={nameState} validLabel={validation.validLabel}>
        <Input
            id="process-name"
            value={data.name}
            onChange={(event) => setData('name', event.target.value)}
            placeholder={t('jobs.processNamePlaceholder')}
            maxLength={255}
            aria-label={t('jobs.processName')}
            aria-invalid={nameState === 'invalid' ? true : undefined}
            data-field-path="name"
            data-validation-state={ogcValidationDataState(nameState)}
            aria-describedby={nameError ? 'error-name' : undefined}
            className={cn(ogcValidationControlClassName(nameState))}
        />
    </OgcValidationControl>
    <OgcFieldError id="error-name" message={nameError} />
</Field>
```

- [ ] **Step 5: Format and verify GREEN**

```bash
bunx prettier --write resources/js/hooks/use-ogc-form-validation.ts resources/js/components/ogc/dynamic-process-form.tsx tests/Frontend/ogc-validation-wiring.test.ts
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-validation.test.ts tests/Frontend/ogc-form-errors.test.ts
bun run types:check
```

Expected: root wiring and pure behavior tests pass; TypeScript exits with code 0.

- [ ] **Step 6: Commit root validation orchestration**

```bash
git add resources/js/hooks/use-ogc-form-validation.ts resources/js/components/ogc/dynamic-process-form.tsx tests/Frontend/ogc-validation-wiring.test.ts
git commit -m "feat: validate all OGC fields before submission"
```

---

### Task 4: Wire Validation Feedback Through Every Dynamic Input Kind

**Files:**

- Modify: `resources/js/components/ogc/dynamic-process-form.tsx`
- Modify: `resources/js/components/ogc/section-field-set.tsx`
- Modify: `resources/js/components/ogc/schema-field-renderer.tsx`
- Modify: `resources/js/components/ogc/one-of-field.tsx`
- Modify: `resources/js/components/ogc/array-table-field.tsx`
- Modify: `resources/js/components/ogc/array-object-field.tsx`
- Modify: `resources/js/components/ogc/data-input-field.tsx`
- Modify: `tests/Frontend/ogc-validation-wiring.test.ts`
- Modify: `tests/Frontend/ogc-form-errors.test.ts`

**Interfaces:**

- Replace each dynamic component's `errors: OgcFormErrors` prop with `validation: OgcFieldValidationController`.
- Each leaf derives `error = fieldError(validation.errors, path)` and `state = validation.stateFor(path, error)`.
- Native inputs rely on root `onChangeCapture`; Radix value changes call `validation.fieldChanged(path)` explicitly.
- Variant/mode/row removals call `validation.resetPathPrefix(prefix)` before changing the structure.

- [ ] **Step 1: Extend the wiring test for every field kind**

Append to `tests/Frontend/ogc-validation-wiring.test.ts`:

```ts
test('uses OGC feedback instead of shared plain errors in every field kind', () => {
    const files = [
        'resources/js/components/ogc/section-field-set.tsx',
        'resources/js/components/ogc/schema-field-renderer.tsx',
        'resources/js/components/ogc/one-of-field.tsx',
        'resources/js/components/ogc/array-table-field.tsx',
        'resources/js/components/ogc/data-input-field.tsx',
    ];

    for (const file of files) {
        const contents = source(file);

        expect(contents).toContain('OgcFieldError');
        expect(contents).not.toContain('@/components/input-error');
    }
});

test('clears only structurally obsolete variant and row paths', () => {
    const oneOf = source('resources/js/components/ogc/one-of-field.tsx');
    const table = source('resources/js/components/ogc/array-table-field.tsx');
    const objects = source(
        'resources/js/components/ogc/array-object-field.tsx',
    );
    const dataInput = source(
        'resources/js/components/ogc/data-input-field.tsx',
    );

    expect(oneOf).toContain("resetPathPrefix(path + '.value')");
    expect(table).toContain('resetPathPrefix(path)');
    expect(objects).toContain('resetPathPrefix(path)');
    expect(dataInput).toContain('resetPathPrefix(path)');
});

test('renders corrected icons and data state on scalar, enum, and table controls', () => {
    const renderer = source(
        'resources/js/components/ogc/schema-field-renderer.tsx',
    );
    const table = source('resources/js/components/ogc/array-table-field.tsx');

    expect(renderer).toContain('OgcValidationControl');
    expect(renderer).toContain('data-validation-state');
    expect(table).toContain('OgcValidationControl');
    expect(table).toContain('ogcValidationControlClassName');
});
```

In the existing `wires failed submit focus and field accessibility` test in `tests/Frontend/ogc-form-errors.test.ts`, replace the obsolete table assertion with:

```ts
expect(table).toContain('OgcFieldError');
expect(table).toContain('OgcValidationControl');
expect(table).not.toContain('@/components/input-error');
```

- [ ] **Step 2: Run the wiring test and verify RED**

```bash
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-errors.test.ts
```

Expected: FAIL because nested components still use `InputError`, do not accept the controller, and do not render corrected state.

- [ ] **Step 3: Upgrade `SectionFieldSet`**

Replace its `InputError` import with the OGC feedback imports, add `validationState?: OgcFieldValidationState`, and resolve the state before rendering:

```tsx
const resolvedValidationState =
    validationState ?? (error ? 'invalid' : 'neutral');
```

Render:

```tsx
<FieldSet
    className={cn(
        'block max-w-full min-w-0 gap-4 rounded-md border bg-muted/30 p-4 shadow-xs dark:border-border/70 dark:bg-muted/20',
        ogcValidationContainerClassName(resolvedValidationState),
        className,
    )}
    data-field-path={fieldPath}
    data-invalid={resolvedValidationState === 'invalid' ? true : undefined}
    data-validation-state={ogcValidationDataState(resolvedValidationState)}
    tabIndex={fieldPath ? -1 : undefined}
    aria-invalid={error ? true : undefined}
    aria-describedby={error ? errorId : undefined}
>
    <FieldLegend className="mb-1 w-fit px-1 text-sm">{label}</FieldLegend>
    <div className="flex min-w-0 flex-col gap-4">
        {description ? (
            <FieldDescription className="break-words">
                {description}
            </FieldDescription>
        ) : null}
        <OgcFieldError id={errorId} message={error} />
        {children}
    </div>
</FieldSet>
```

The resolved state therefore remains invalid for legacy structural callers that provide an error before every caller is migrated.

- [ ] **Step 4: Upgrade scalar, enum, and object rendering**

In `schema-field-renderer.tsx`:

1. Replace `errors` with `validation` in the signature and all child calls.
2. Alias `const errors = validation.errors;` at the top.
3. For object fieldsets, pass:

```tsx
validationState={validation.stateFor(path, error)}
```

4. For enum fields, calculate `state`, call `validation.fieldChanged(path)` before `onChange`, wrap `SelectTrigger` in `OgcValidationControl` with `hasBuiltInEndIcon`, and set:

```tsx
className={cn(
    'w-full min-w-0',
    ogcValidationControlClassName(state, true),
)}
data-validation-state={ogcValidationDataState(state)}
aria-invalid={state === 'invalid' ? true : undefined}
```

5. For scalar inputs, wrap the `Input`, use the same state attributes/classes without `hasBuiltInEndIcon`, and replace `InputError` with:

```tsx
<OgcFieldError id={errorId} message={error} />
```

6. Set `data-invalid={state === 'invalid' ? true : undefined}` on each leaf `Field`.

- [ ] **Step 5: Upgrade oneOf variant handling**

In `one-of-field.tsx`:

1. Replace `errors` with `validation` and derive `errors`, `structuralState`, `variantError`, and `variantState`.
2. Before changing the selected variant, execute:

```tsx
validation.resetPathPrefix(path + '.value');
validation.fieldChanged(path + '.variant');
```

3. Pass `validationState={structuralState}` to `SectionFieldSet`.
4. Wrap and style the selector with `OgcValidationControl`, including `hasBuiltInEndIcon`, `data-validation-state`, red/green control classes, and `aria-invalid` derived from `variantState`.
5. Replace the selector's `InputError` with `OgcFieldError`.
6. Pass `validation` to every nested `SchemaFieldRenderer`.

- [ ] **Step 6: Upgrade array-table cells and structural row changes**

In `array-table-field.tsx`:

1. Replace `errors` with `validation`, derive the structural state, and pass it to `SectionFieldSet`.
2. For every cell, derive `state`, add a compact shadcn `Field` with `data-invalid`, wrap the `Input` in `OgcValidationControl`, add validation classes/data state, and use `OgcFieldError` below it.
3. Before removing a row, clear reindexed errors and corrected paths:

```tsx
validation.resetPathPrefix(path);
onChange(rows.filter((_, index) => index !== rowIndex));
```

4. Before adding a row, clear only a direct structural server error:

```tsx
validation.fieldChanged(path);
onChange([...rows, columns.map(() => '')]);
```

- [ ] **Step 7: Upgrade array-object rows**

In `array-object-field.tsx`:

1. Replace `errors` with `validation`, derive/pass structural state, and forward `validation` to nested renderers.
2. Before removing a row, call `validation.resetPathPrefix(path)` and then update the array.
3. Before adding a row, call `validation.fieldChanged(path)` and then append the object.

- [ ] **Step 8: Upgrade complex inline/reference/upload controls**

In `data-input-field.tsx`:

1. Replace `errors` with `validation`; derive `error`, `errorId`, and `state`.
2. When the mode changes, call `validation.resetPathPrefix(path)` before `setMode(nextMode)`.
3. In the Radix reference selector, update the reference and then call `validation.valuesReplaced(path)` so an existing native URL error is rechecked after React commits the selected URL. The ordinary URL input continues to use form-level change capture.
4. Set `data-invalid` on the active inner `Field`.
5. Wrap every active `Textarea`, `SelectTrigger`, URL `Input`, and file `Input` in `OgcValidationControl`; use `hasBuiltInEndIcon` for the Select trigger.
6. Apply the control classes, `data-validation-state`, `aria-invalid`, and `aria-describedby` consistently.
7. Replace the single trailing `InputError` with `OgcFieldError`.
8. Keep the outer `SectionFieldSet` without `fieldPath={path}` so the active leaf control remains the exact focus target when both share the same path.

- [ ] **Step 9: Switch the root renderer to the controller contract**

In `dynamic-process-form.tsx`, replace:

```tsx
errors={validation.errors}
```

with:

```tsx
<SchemaFieldRenderer validation={validation} />
```

Preserve the component's other existing props. Do not change `ProcessOutputSelector` yet; Task 5 handles output-specific paths.

- [ ] **Step 10: Format and verify GREEN**

```bash
bunx prettier --write resources/js/components/ogc/dynamic-process-form.tsx resources/js/components/ogc/section-field-set.tsx resources/js/components/ogc/schema-field-renderer.tsx resources/js/components/ogc/one-of-field.tsx resources/js/components/ogc/array-table-field.tsx resources/js/components/ogc/array-object-field.tsx resources/js/components/ogc/data-input-field.tsx tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-errors.test.ts
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-validation.test.ts tests/Frontend/ogc-form-errors.test.ts tests/Frontend/ogc-field-validation-feedback.test.tsx tests/Frontend/html-pattern.test.ts tests/Frontend/ogc-form-values.test.ts tests/Frontend/ogc-fields.test.ts
bun run types:check
```

Expected: all focused OGC validation and field tests pass; TypeScript exits with code 0.

- [ ] **Step 11: Commit dynamic field feedback**

```bash
git add resources/js/components/ogc/dynamic-process-form.tsx resources/js/components/ogc/section-field-set.tsx resources/js/components/ogc/schema-field-renderer.tsx resources/js/components/ogc/one-of-field.tsx resources/js/components/ogc/array-table-field.tsx resources/js/components/ogc/array-object-field.tsx resources/js/components/ogc/data-input-field.tsx tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/ogc-form-errors.test.ts
git commit -m "feat: show OGC field validation states"
```

---

### Task 5: Map Output Errors to Exact Checkbox and Format Controls

**Files:**

- Modify: `resources/js/components/ogc/process-output-selector.tsx`
- Modify: `resources/js/components/ogc/dynamic-process-form.tsx`
- Modify: `tests/Frontend/ogc-validation-wiring.test.ts`
- Modify: `tests/Frontend/process-output-selection.test.ts`

**Interfaces:**

- `ProcessOutputSelector` receives `validation: OgcFieldValidationController` instead of one flattened `error`.
- Output checkbox path: `outputs.${outputId}`.
- Output format path: `outputs.${outputId}.format`.
- Structural fallback path: `outputs`.

- [ ] **Step 1: Write failing exact-output wiring tests**

Append to `tests/Frontend/ogc-validation-wiring.test.ts`:

```ts
test('maps output and format errors to focusable dotted paths', () => {
    const outputs = source(
        'resources/js/components/ogc/process-output-selector.tsx',
    );

    expect(outputs).toContain("const outputPath = 'outputs.' + outputId");
    expect(outputs).toContain("const formatPath = outputPath + '.format'");
    expect(outputs).toContain('data-field-path={outputPath}');
    expect(outputs).toContain('data-field-path={formatPath}');
    expect(outputs).toContain('OgcFieldError');
    expect(outputs).not.toContain('@/components/input-error');
});
```

Add to `tests/Frontend/process-output-selection.test.ts` a regression assertion proving the existing helper still returns the first unmapped fallback message:

```ts
test('keeps an unknown output error available for structural fallback', () => {
    expect(
        firstOutputError({
            'outputs.unknown': 'This output is not available.',
        }),
    ).toBe('This output is not available.');
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/process-output-selection.test.ts
```

Expected: the new output wiring test fails because output errors are flattened to one plain message without field paths.

- [ ] **Step 3: Implement exact output feedback**

In `process-output-selector.tsx`:

1. Replace the shared `InputError` import with OGC feedback imports.
2. Import `fieldError`, `errorIdForPath`, `firstOutputError`, validation types/helpers, and `cn`.
3. Replace the `error?: string` prop with `validation: OgcFieldValidationController`.
4. Derive `errors = validation.errors`, determine whether any known output path has an error, and use `firstOutputError(errors)` only when no known output can display it. The structural section message is:

```tsx
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
const sectionState = validation.stateFor('outputs', sectionError);
```

5. Put `data-field-path="outputs"`, `tabIndex={-1}`, error ARIA attributes, validation data state, and `ogcValidationContainerClassName(sectionState)` on `CardContent`. Render `OgcFieldError` for `sectionError` after the output rows.
6. Pass `validation` to every `OutputSelectionRow`.
7. In each row, derive:

```tsx
const outputPath = 'outputs.' + outputId;
const formatPath = outputPath + '.format';
const outputError = fieldError(validation.errors, outputPath);
const formatError = Object.entries(validation.errors).find(
    ([path, message]) =>
        Boolean(message) &&
        (path === formatPath || path.startsWith(formatPath + '.')),
)?.[1];
const outputState = validation.stateFor(outputPath, outputError);
const formatState = validation.stateFor(formatPath, formatError);
```

8. Add `data-field-path={outputPath}`, `aria-invalid`, and red validation classes to the checkbox. Preserve the existing description and append the error ID when present:

```tsx
aria-describedby={
    [
        output.description ? controlId + '-description' : null,
        outputError ? errorIdForPath(outputPath) : null,
    ]
        .filter((id): id is string => Boolean(id))
        .join(' ') || undefined
}
```

Because output errors are server-only, changing selection calls `validation.resetPathPrefix(outputPath)` and returns the row to neutral; no corrected icon is rendered on the checkbox.

9. Render `OgcFieldError` beside the output label for `outputError`.
10. Wrap the format `SelectTrigger` in `OgcValidationControl`, add `data-field-path={formatPath}`, state classes/data/ARIA, and render `OgcFieldError` below it. A format selection calls `validation.resetPathPrefix(formatPath)` before `onFormatChange(format)`.

- [ ] **Step 4: Pass the controller from the root**

In `dynamic-process-form.tsx`, replace the flattened output error prop with:

```tsx
<ProcessOutputSelector
    outputs={schema.outputs}
    selections={outputSelections}
    onChange={(outputs) => setData('outputs', outputs)}
    validation={validation}
/>
```

Remove the now-unused `firstOutputError` import from this file.

- [ ] **Step 5: Format and verify GREEN**

```bash
bunx prettier --write resources/js/components/ogc/process-output-selector.tsx resources/js/components/ogc/dynamic-process-form.tsx tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/process-output-selection.test.ts
bun test tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/process-output-selection.test.ts tests/Frontend/ogc-form-errors.test.ts tests/Frontend/ogc-form-validation.test.ts
bun run types:check
```

Expected: output errors map to exact dotted controls, all focused tests pass, and TypeScript exits with code 0.

- [ ] **Step 6: Commit output error mapping**

```bash
git add resources/js/components/ogc/process-output-selector.tsx resources/js/components/ogc/dynamic-process-form.tsx tests/Frontend/ogc-validation-wiring.test.ts tests/Frontend/process-output-selection.test.ts
git commit -m "feat: map OGC output validation feedback"
```

---

### Task 6: Full Verification and Real-Browser Dark-Mode QA

**Files:**

- Verify all files modified in Tasks 1-5.
- No production file is added in this task.

**Interfaces:**

- Consumes the complete feature.
- Produces fresh verification evidence for tests, formatting, lint, type safety, production build, viewport-centered navigation, corrected state, and dark mode.

- [ ] **Step 1: Run all frontend tests**

```bash
bun test tests/Frontend
```

Expected: all frontend tests pass with zero failures.

- [ ] **Step 2: Run formatting, lint, and type checks**

```bash
bun run format:check
bun run lint:check
bun run types:check
```

Expected: all three commands exit with code 0 and no errors.

- [ ] **Step 3: Run the production build**

```bash
bun run build
```

Expected: Vite completes the production build with exit code 0.

- [ ] **Step 4: Identify affected tests from the code graph**

Call TokenSave `tokensave_affected` with every changed `resources/js` file from Tasks 1-5. Run any additional returned frontend test that was not included above.

Expected: TokenSave reports no unexecuted affected test after the follow-up run.

- [ ] **Step 5: Verify the behavior in a real browser**

Use the `playwright` skill and its bundled CLI wrapper:

1. Resolve the application URL with Laravel Boost `get-absolute-url`.
2. Open the process catalog, choose the first ready process exposing at least two required native controls, and open its execution form.
3. Press `Execute` with both required values empty.
4. Confirm there is no native validation bubble.
5. Confirm both controls have red border/ring and separate icon-bearing red boxes.
6. Confirm the first invalid control is focused and its bounding-box center is within 10% of `window.innerHeight / 2`.
7. Correct only the first field and confirm it receives the emerald border/ring and check icon while the second remains red.
8. Confirm an untouched valid field remains neutral.
9. Switch the application to dark mode and confirm destructive and corrected feedback remain readable and visible.
10. Capture one light-mode and one dark-mode screenshot for visual inspection; do not add screenshots to Git.

Expected: every acceptance criterion is observable in Chromium with no browser console error.

- [ ] **Step 6: Inspect the final diff**

```bash
git status --short
git diff HEAD~5 --check
git diff HEAD~5 --stat
```

Expected: no uncommitted changes from this validation work, no whitespace errors, and the task diff is limited to the planned OGC validation, translations, and frontend tests. Any unrelated pre-existing worktree changes remain untouched and may still appear in `git status`.

- [ ] **Step 7: Complete the branch**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present the verified merge/PR/keep-worktree options without pushing or merging unless the user selects one.
