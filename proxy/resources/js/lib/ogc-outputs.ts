import type { OgcNormalizedOutput } from '@/types';

type OgcOutputComponent = NonNullable<
    OgcNormalizedOutput['components']
>[string];

export function defaultOutputTransmissionMode(
    output?: OgcNormalizedOutput,
): string {
    return automaticOutputTransmissionMode(output);
}

export function automaticOutputTransmissionMode(
    output?: OgcNormalizedOutput,
): 'value' | 'reference' {
    const mediaType = baseMediaType(output?.mediaType);

    if (
        mediaType === 'text/plain' ||
        mediaType === 'application/json' ||
        mediaType?.endsWith('+json')
    ) {
        return 'value';
    }

    return 'reference';
}

export function outputComponents(
    output: OgcNormalizedOutput,
): { componentId: string; component: OgcOutputComponent }[] {
    return Object.entries(output.components ?? {}).map(
        ([componentId, component]) => ({
            componentId,
            component,
        }),
    );
}

function baseMediaType(mediaType?: string | null): string | null {
    if (!mediaType) {
        return null;
    }

    return mediaType.split(';')[0].trim().toLowerCase();
}
