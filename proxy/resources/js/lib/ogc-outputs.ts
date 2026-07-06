import type { OgcNormalizedOutput } from '@/types';

type OgcOutputComponent = NonNullable<
    OgcNormalizedOutput['components']
>[string];

export function defaultOutputTransmissionMode(
    output?: OgcNormalizedOutput,
): string {
    return output?.schemaType === 'object' ? 'reference' : 'value';
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
