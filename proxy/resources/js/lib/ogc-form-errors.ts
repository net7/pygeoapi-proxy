export type OgcFormErrors = Record<string, string | undefined>;

export function fieldError(
    errors: OgcFormErrors,
    path: string,
): string | undefined {
    return errors[path];
}

export function errorIdForPath(path: string): string {
    return 'error-' + path.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
}

export function oneOfStructuralError(
    errors: OgcFormErrors,
    path: string,
): string | undefined {
    return fieldError(errors, path) ?? fieldError(errors, path + '.value');
}

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

    const exact = controlPaths.find((path) => errorPaths.includes(path));

    if (exact) {
        return exact;
    }

    return (
        controlPaths.find((path) =>
            errorPaths.some((errorPath) => errorPath.startsWith(path + '.')),
        ) ?? null
    );
}

export function focusFirstInvalidField(
    form: HTMLFormElement | null,
    errors: OgcFormErrors,
): boolean {
    if (!form) {
        return false;
    }

    const controls = Array.from(
        form.querySelectorAll<HTMLElement>('[data-field-path]'),
    );
    const path = firstInvalidFieldPath(
        controls
            .map((control) => control.dataset.fieldPath)
            .filter((value): value is string => Boolean(value)),
        errors,
    );
    const target = controls.find(
        (control) => control.dataset.fieldPath === path,
    );

    if (!target) {
        return false;
    }

    target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
    });
    target.focus({
        preventScroll: true,
    });

    return true;
}
