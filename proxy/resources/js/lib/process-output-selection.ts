import type { OgcNormalizedOutput, OgcOutputFormat } from '@/types';

export type ProcessOutputSelection = {
    selected: boolean;
    format: OgcOutputFormat | null;
};

export type ProcessOutputSelections = Record<string, ProcessOutputSelection>;

export type ProcessOutputRequest = Record<
    string,
    {
        format?: {
            mediaType: string;
            encoding?: string;
            schema?: string | Record<string, unknown>;
        };
    }
>;

export function initialOutputSelections(
    outputs: Record<string, OgcNormalizedOutput>,
): ProcessOutputSelections {
    return Object.fromEntries(
        Object.entries(outputs).map(([outputId, output]) => [
            outputId,
            {
                selected: true,
                format: output.formats[0] ?? null,
            },
        ]),
    );
}

export function setOutputSelected(
    selections: ProcessOutputSelections,
    outputId: string,
    selected: boolean,
): ProcessOutputSelections {
    const current = selections[outputId];

    if (!current) {
        return selections;
    }

    return {
        ...selections,
        [outputId]: {
            ...current,
            selected,
        },
    };
}

export function setOutputFormat(
    selections: ProcessOutputSelections,
    outputId: string,
    format: OgcOutputFormat,
): ProcessOutputSelections {
    const current = selections[outputId];

    if (!current) {
        return selections;
    }

    return {
        ...selections,
        [outputId]: {
            ...current,
            format,
        },
    };
}

export function buildRequestedOutputs(
    selections: ProcessOutputSelections,
): ProcessOutputRequest {
    return Object.fromEntries(
        Object.entries(selections)
            .filter(([, selection]) => selection.selected)
            .map(([outputId, selection]) => [
                outputId,
                selection.format
                    ? {
                          format: requestFormat(selection.format),
                      }
                    : {},
            ]),
    );
}

export function outputFormatKey(format: OgcOutputFormat): string {
    return JSON.stringify(
        canonicalize({
            mediaType: format.mediaType,
            encoding: format.encoding ?? null,
            schema: format.schema ?? null,
        }),
    );
}

export function outputFormatLabel(format: OgcOutputFormat): string {
    return format.label === format.mediaType
        ? format.mediaType
        : format.label + ' — ' + format.mediaType;
}

export function firstOutputError(
    errors: Record<string, string | undefined>,
): string | undefined {
    return Object.entries(errors).find(
        ([key, value]) =>
            Boolean(value) && (key === 'outputs' || key.startsWith('outputs.')),
    )?.[1];
}

function requestFormat(format: OgcOutputFormat) {
    return {
        mediaType: format.mediaType,
        ...(format.encoding ? { encoding: format.encoding } : {}),
        ...(format.schema !== undefined ? { schema: format.schema } : {}),
    };
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }

    if (!isRecord(value)) {
        return value;
    }

    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, canonicalize(value[key])]),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
