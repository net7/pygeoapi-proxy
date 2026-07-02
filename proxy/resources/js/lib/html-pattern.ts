export function htmlPatternForInput({
    type,
    pattern,
}: {
    type?: string | null;
    pattern?: string | null;
}): string | undefined {
    if (!pattern || type === 'number' || type === 'integer') {
        return undefined;
    }

    try {
        new RegExp(pattern, 'v');
    } catch {
        return undefined;
    }

    return pattern;
}
