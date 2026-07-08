import type { ProcessExecutionResult } from '@/types';

export function hasPendingMapLayers(
    results: ProcessExecutionResult[],
): boolean {
    return results.some(({ mapLayer }) => {
        const status = mapLayer.status;

        return status === 'pending' || status === 'publishing';
    });
}
