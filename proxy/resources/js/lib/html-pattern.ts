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

    if (/\[\[:[a-z]+:\]\]/i.test(pattern)) {
        return undefined;
    }

    const browserPattern = pattern.replaceAll('[+-]', '[+\\-]');

    try {
        new RegExp(browserPattern, 'v');
    } catch {
        return undefined;
    }

    return browserPattern;
}
