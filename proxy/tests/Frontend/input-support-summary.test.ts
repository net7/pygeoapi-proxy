import { describe, expect, test } from 'bun:test';

import { inputSupportSummary } from '../../resources/js/lib/input-support-summary';
import type {
    OgcInputReview,
    ProcessExecutionDetail,
} from '../../resources/js/types';

const execution = {
    id: 42,
    remoteJobId: 'job-abc',
    processId: 'example-process',
    processVersion: '1.2',
    requestPayload: { private_metadata: 'not part of the input review' },
} as ProcessExecutionDetail;

describe('support summary', () => {
    test('copies the job identifiers and original input keys and values', () => {
        const review: OgcInputReview = {
            fields: {},
            inputs: {
                max_distance: 0,
                enabled: false,
                note: '',
                samples: [{ pressure: 100 }],
            },
            legacy: false,
            unavailableInputs: [],
            files: [],
        };

        const summary = JSON.parse(inputSupportSummary(review, execution));

        expect(summary).toEqual({
            job: {
                localId: 42,
                remoteId: 'job-abc',
                processId: 'example-process',
                processVersion: '1.2',
            },
            inputs: {
                max_distance: 0,
                enabled: false,
                note: '',
                samples: [{ pressure: 100 }],
            },
            legacy: false,
            unavailableInputs: [],
            files: [],
        });
    });

    test('marks incomplete data and includes attachment metadata without inventing values', () => {
        const review: OgcInputReview = {
            fields: {},
            inputs: { secret: '[redacted]', known: { value: 12 } },
            legacy: true,
            unavailableInputs: ['secret', 'missing'],
            files: [
                {
                    id: 7,
                    name: 'measurements.csv',
                    path: ['data'],
                    sizeBytes: 120,
                    mediaType: 'text/csv',
                    available: false,
                },
            ],
        };

        const summary = JSON.parse(
            inputSupportSummary(review, {
                ...execution,
                remoteJobId: null,
                processVersion: null,
            }),
        );

        expect(summary.inputs).toEqual({ known: { value: 12 } });
        expect(summary.unavailableInputs).toEqual(['secret', 'missing']);
        expect(summary.legacy).toBe(true);
        expect(summary.job.remoteId).toBeNull();
        expect(summary.job.processVersion).toBeNull();
        expect(summary.files).toEqual([
            {
                name: 'measurements.csv',
                path: ['data'],
                sizeBytes: 120,
                mediaType: 'text/csv',
                available: false,
            },
        ]);
    });
});
