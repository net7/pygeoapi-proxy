import type { ProcessExecutionResult } from '@/types';

export type ProcessResultVisualItem =
    | {
          kind: 'result';
          result: ProcessExecutionResult;
      }
    | {
          kind: 'geotiff-map';
          outputId: string;
          title: string;
          description?: string | null;
          geotiff: ProcessExecutionResult;
          sld: ProcessExecutionResult;
      };

type ComponentName = 'geotiff' | 'sld';

type OutputComponentMatch = {
    outputId: string;
    component: ComponentName;
};

export function groupProcessResults(
    results: ProcessExecutionResult[],
): ProcessResultVisualItem[] {
    const components = new Map<
        string,
        Partial<Record<ComponentName, ProcessExecutionResult>>
    >();

    for (const result of results) {
        const match = outputComponentMatch(result.outputId);

        if (!match) {
            continue;
        }

        const outputComponents = components.get(match.outputId) ?? {};
        outputComponents[match.component] = result;
        components.set(match.outputId, outputComponents);
    }

    const groupedOutputIds = new Set<string>();

    for (const [outputId, outputComponents] of components.entries()) {
        if (
            outputComponents.geotiff &&
            outputComponents.sld &&
            isGeoTiffResult(outputComponents.geotiff) &&
            isSldResult(outputComponents.sld)
        ) {
            groupedOutputIds.add(outputId);
        }
    }

    const emittedGroups = new Set<string>();
    const visualItems: ProcessResultVisualItem[] = [];

    for (const result of results) {
        const match = outputComponentMatch(result.outputId);

        if (!match || !groupedOutputIds.has(match.outputId)) {
            visualItems.push({ kind: 'result', result });
            continue;
        }

        if (emittedGroups.has(match.outputId)) {
            continue;
        }

        const outputComponents = components.get(match.outputId);
        const geotiff = outputComponents?.geotiff;
        const sld = outputComponents?.sld;

        if (!geotiff || !sld) {
            visualItems.push({ kind: 'result', result });
            continue;
        }

        visualItems.push({
            kind: 'geotiff-map',
            outputId: match.outputId,
            title: groupedTitle(match.outputId, geotiff, sld),
            description: geotiff.description ?? sld.description,
            geotiff,
            sld,
        });
        emittedGroups.add(match.outputId);
    }

    return visualItems;
}

function outputComponentMatch(outputId: string): OutputComponentMatch | null {
    const match = outputId.match(/^(.+)\.(geotiff|sld)$/);

    if (!match) {
        return null;
    }

    return {
        outputId: match[1],
        component: match[2] as ComponentName,
    };
}

function groupedTitle(
    outputId: string,
    geotiff: ProcessExecutionResult,
    sld: ProcessExecutionResult,
): string {
    const componentTitle = geotiff.title ?? sld.title;

    if (componentTitle?.includes(' - ')) {
        return componentTitle.split(' - ')[0];
    }

    return humanizeOutputId(outputId);
}

function humanizeOutputId(outputId: string): string {
    return outputId
        .split(/[_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function isGeoTiffResult(result: ProcessExecutionResult): boolean {
    const mediaType = normalizedMediaType(result.mediaType);

    return (
        (mediaType.startsWith('image/tiff') ||
            mediaType.startsWith('application/tiff')) &&
        mediaType.includes('geotiff')
    );
}

function isSldResult(result: ProcessExecutionResult): boolean {
    return baseMediaType(result.mediaType) === 'application/vnd.ogc.sld+xml';
}

function normalizedMediaType(mediaType?: string | null): string {
    return String(mediaType ?? '')
        .trim()
        .toLowerCase();
}

function baseMediaType(mediaType?: string | null): string {
    return normalizedMediaType(mediaType).split(';')[0].trim();
}
