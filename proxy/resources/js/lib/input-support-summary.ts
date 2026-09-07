import type { OgcInputReview, ProcessExecutionDetail } from '@/types';

export function inputSupportSummary(
    review: OgcInputReview,
    execution: Pick<
        ProcessExecutionDetail,
        'id' | 'remoteJobId' | 'processId' | 'processVersion'
    >,
): string {
    const unavailable = new Set(review.unavailableInputs);

    return JSON.stringify(
        {
            job: {
                localId: execution.id,
                remoteId: execution.remoteJobId ?? null,
                processId: execution.processId,
                processVersion: execution.processVersion ?? null,
            },
            inputs: Object.fromEntries(
                Object.entries(review.inputs).filter(
                    ([name]) => !unavailable.has(name),
                ),
            ),
            legacy: review.legacy,
            unavailableInputs: review.unavailableInputs,
            files: review.files.map(
                ({ name, path, sizeBytes, mediaType, available }) => ({
                    name,
                    path,
                    sizeBytes,
                    mediaType,
                    available,
                }),
            ),
        },
        null,
        2,
    );
}
