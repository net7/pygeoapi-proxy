import type { FormEvent, RefObject } from 'react';
import { useCallback, useMemo, useReducer } from 'react';

import { fieldError, focusFirstInvalidField } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
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
    OgcConstraintMessageResolver,
    OgcFieldValidationController,
    OgcFieldValidationState,
} from '@/lib/ogc-form-validation';

type UseOgcFormValidationOptions = {
    formRef: RefObject<HTMLFormElement | null>;
    serverErrors: OgcFormErrors;
    clearServerErrors: (...paths: string[]) => void;
    constraintMessage: OgcConstraintMessageResolver;
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
    constraintMessage,
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
                    constraintMessage(control) ||
                    lifecycle.clientErrors[path] ||
                    '',
            });
        },
        [
            clearServerErrors,
            constraintMessage,
            formRef,
            lifecycle.clientErrors,
            serverErrors,
        ],
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
        const nextClientErrors = collectFormConstraintErrors(
            formRef.current,
            constraintMessage,
        );

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
    }, [constraintMessage, focusErrors, formRef, serverErrors]);

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
        valuesReplaced,
        handleFormChange,
        validateForm,
        focusErrors,
    };
}
