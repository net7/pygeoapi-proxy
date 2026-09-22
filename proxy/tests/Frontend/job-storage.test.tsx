import * as inertia from '@inertiajs/react';
import { describe, expect, spyOn, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { JobDeletionStorage } from '../../resources/js/components/ogc/job-deletion-storage';
import { JobStorageDatabaseNotice } from '../../resources/js/components/ogc/job-storage-database-notice';
import { JobStorageButton } from '../../resources/js/components/ogc/job-storage-dialog';
import JobStorageTree from '../../resources/js/components/ogc/job-storage-tree';
import * as storageHook from '../../resources/js/hooks/use-job-storage';
import { jobStorageVersion } from '../../resources/js/lib/job-storage';
import type {
    JobStorage,
    JobStorageNode,
    ProcessExecutionDetail,
    ProcessExecutionResult,
} from '../../resources/js/types';

describe('job storage', () => {
    test('only renders the storage action when the backend grants permission', () => {
        const execution = {
            id: 1,
            displayName: 'Example job',
            status: 'running',
            resultCollection: { status: null },
            results: [],
        };

        expect(
            renderToStaticMarkup(<JobStorageButton execution={execution} />),
        ).toBe('');
        expect(
            renderToStaticMarkup(
                <JobStorageButton
                    execution={{ ...execution, canViewStorage: false }}
                />,
            ),
        ).toBe('');

        const html = renderToStaticMarkup(
            <JobStorageButton
                execution={{ ...execution, canViewStorage: true }}
            />,
        );

        expect(html).toContain('Disk usage');
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).not.toContain('role="tree"');
    });

    test('shows the root files and sizes while keeping subdirectories collapsed', () => {
        const file: JobStorageNode = {
            name: '<private>.tif',
            path: 'ogc-results/1/<private>.tif',
            type: 'file',
            sizeBytes: 1024,
            fileCount: 1,
            children: [],
        };
        const nodes: JobStorageNode[] = [
            {
                name: 'ogc-results/1',
                path: 'ogc-results/1',
                type: 'directory',
                sizeBytes: 1024,
                fileCount: 2,
                children: [
                    {
                        name: 'nested',
                        path: 'ogc-results/1/nested',
                        type: 'directory',
                        sizeBytes: 0,
                        fileCount: 1,
                        children: [
                            {
                                ...file,
                                name: 'hidden.csv',
                                path: 'ogc-results/1/nested/hidden.csv',
                                sizeBytes: 0,
                            },
                        ],
                    },
                    file,
                    {
                        name: 'empty',
                        path: 'ogc-results/1/empty',
                        type: 'directory',
                        sizeBytes: 0,
                        fileCount: 0,
                        children: [],
                    },
                ],
            },
        ];

        const html = renderToStaticMarkup(
            <JobStorageTree nodes={nodes} label="Job files" locale="en-GB" />,
        );

        expect(html).toContain('role="tree"');
        expect(html).toContain('aria-label="Job files"');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('1 KiB');
        expect(html).toContain('0 B');
        expect(html).toContain('&lt;private&gt;.tif');
        expect(html).not.toContain('<private>');
        expect(html).not.toContain('hidden.csv');
        expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    });
});

describe('job storage explanations', () => {
    const data: JobStorage = {
        totalSizeBytes: 1536,
        fileCount: 1,
        databaseResultCount: 0,
        roots: [],
        inspectedAt: '2026-09-22T10:30:00Z',
    };

    function renderDeletionStorage(
        isAdmin: boolean,
        state: storageHook.JobStorageState,
    ) {
        const auth = spyOn(inertia, 'usePage').mockReturnValue({
            props: { auth: { user: { is_admin: isAdmin } } },
        } as ReturnType<typeof inertia.usePage>);
        const storage = spyOn(storageHook, 'useJobStorage').mockReturnValue(
            state,
        );

        try {
            const html = renderToStaticMarkup(
                <JobDeletionStorage
                    execution={{
                        id: 1,
                        displayName: 'Example',
                        processId: 'example',
                        status: 'successful',
                        progress: 100,
                    }}
                />,
            );

            return { html, inspected: storage.mock.calls.length };
        } finally {
            auth.mockRestore();
            storage.mockRestore();
        }
    }

    test('shows the file space to admins in the deletion confirmation', () => {
        const { html } = renderDeletionStorage(true, { status: 'ready', data });

        expect(html).toContain('File space to be freed');
        expect(html).toContain('1.5 KiB');
        expect(html).toContain('Admins only');
        expect(html).not.toContain('Results are stored in the database:');
    });

    test('neither displays nor inspects storage for a regular user', () => {
        const { html, inspected } = renderDeletionStorage(false, {
            status: 'ready',
            data,
        });

        expect(html).toBe('');
        expect(inspected).toBe(0);
    });

    test('explains database-only results without claiming database space is freed', () => {
        const { html } = renderDeletionStorage(true, {
            status: 'ready',
            data: {
                ...data,
                totalSizeBytes: 0,
                fileCount: 0,
                databaseResultCount: 1,
            },
        });

        expect(html).toContain('0 B');
        expect(html).toContain('this job has no local files');
        expect(html).toContain('Database storage is not included in the total');
        expect(html).toContain('also be removed from the database');
    });

    test('distinguishes an unavailable estimate from zero file storage', () => {
        const { html } = renderDeletionStorage(true, { status: 'error' });

        expect(html).toContain('The space to be freed could not be calculated');
        expect(html).not.toContain('0 B');
    });

    test('explains that mixed storage totals exclude database results', () => {
        const html = renderToStaticMarkup(
            <JobStorageDatabaseNotice
                storage={{ ...data, databaseResultCount: 1 }}
            />,
        );

        expect(html).toContain('Some results are stored in the database');
        expect(html).toContain('only local files, not database storage');
    });
});

describe('job storage refresh', () => {
    const execution: Pick<
        ProcessExecutionDetail,
        'status' | 'resultCollection' | 'results'
    > = {
        status: 'running',
        resultCollection: { status: null },
        results: [],
    };
    const result: ProcessExecutionResult = {
        id: 1,
        outputId: 'map',
        cacheStatus: 'pending',
        mapLayer: {
            type: 'wms',
            status: 'pending',
            name: null,
            styleName: null,
            bounds: null,
            publishedAt: null,
            error: null,
            warning: null,
        },
    };

    test('refreshes when processing ends and again when result collection finishes', () => {
        const collecting: typeof execution = {
            ...execution,
            status: 'successful',
            resultCollection: { status: 'collecting' },
        };
        const collected: typeof execution = {
            ...collecting,
            resultCollection: { status: 'successful' },
        };

        expect(jobStorageVersion(collecting)).not.toBe(
            jobStorageVersion(execution),
        );
        expect(jobStorageVersion(collected)).not.toBe(
            jobStorageVersion(collecting),
        );
    });

    test('refreshes as outputs are added, downloaded and prepared for the map', () => {
        const pending = { ...execution, results: [result] };
        const downloaded = {
            ...execution,
            results: [{ ...result, cacheStatus: 'cached' }],
        };
        const published: typeof execution = {
            ...downloaded,
            results: [
                {
                    ...downloaded.results[0],
                    mapLayer: {
                        ...result.mapLayer,
                        status: 'published',
                        publishedAt: '2026-09-22T10:30:00Z',
                    },
                },
            ],
        };

        expect(jobStorageVersion(pending)).not.toBe(
            jobStorageVersion(execution),
        );
        expect(jobStorageVersion(downloaded)).not.toBe(
            jobStorageVersion(pending),
        );
        expect(jobStorageVersion(published)).not.toBe(
            jobStorageVersion(downloaded),
        );
    });

    test('keeps storage stable on polls that only change progress or presentation', () => {
        const first = { ...execution, results: [result] };
        const next = {
            ...first,
            progress: 80,
            displayName: 'Renamed job',
            resultCollection: { ...first.resultCollection },
            results: [{ ...result, title: 'Updated title' }],
        };

        expect(jobStorageVersion(next)).toBe(jobStorageVersion(first));
    });
});
