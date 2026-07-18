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
): value is HTMLElement & OgcConstraintControl {
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
