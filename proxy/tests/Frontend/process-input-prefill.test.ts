import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('process input prefill', () => {
    test('links a job to the same process with its source job query parameter', () => {
        const jobDetail = source(
            'resources/js/pages/process-executions/show.tsx',
        );

        expect(jobDetail).toContain('show as processShow');
        expect(jobDetail).toContain("t('jobs.reuseInputs')");
        expect(jobDetail).toContain('sourceJob: execution.id');
    });

    test('uses the same compact size for the reuse and delete actions', () => {
        const jobDetail = source(
            'resources/js/pages/process-executions/show.tsx',
        );
        const deleteDialog = source(
            'resources/js/components/ogc/delete-job-dialog.tsx',
        );

        expect(jobDetail).toContain(
            'variant="outline"\n                                size="sm"',
        );
        expect(deleteDialog).toContain("size={showLabel ? 'sm' : 'icon'}");
    });

    test('initializes only inputs while name, note and outputs keep new-job defaults', () => {
        const form = source(
            'resources/js/components/ogc/dynamic-process-form.tsx',
        );

        expect(form).toContain(
            'initialInputValues(schema.fields, inputPrefill?.inputs)',
        );
        expect(form).toContain("name: ''");
        expect(form).toContain('note: null');
        expect(form).toContain(
            'outputs: initialOutputSelections(schema.outputs)',
        );
    });

    test('shows the source and warns when stored inputs cannot be reused', () => {
        const processDetail = source('resources/js/pages/processes/show.tsx');

        expect(processDetail).toContain("t('ogc.inputPrefillTitle'");
        expect(processDetail).toContain("t('ogc.inputPrefillSkipped'");
        expect(processDetail).toContain('inputPrefill.skippedInputs.join');
        expect(processDetail).toContain(
            'border-info-emphasis bg-info/10 text-info-emphasis shadow-xs *:data-[slot=alert-description]:text-info-emphasis/80',
        );
        expect(processDetail).toContain('<DynamicProcessForm');
        expect(processDetail).toContain('inputPrefill={inputPrefill}');
    });
});
