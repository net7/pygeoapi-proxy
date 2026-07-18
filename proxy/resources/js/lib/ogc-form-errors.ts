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
    const matchingControls = controls.filter(
        (control) => control.dataset.fieldPath === path,
    );
    const target =
        matchingControls.find(isNativelyInvalidControl) ?? matchingControls[0];

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

function isNativelyInvalidControl(control: HTMLElement): boolean {
    try {
        return control.matches(':invalid');
    } catch {
        return false;
    }
}
