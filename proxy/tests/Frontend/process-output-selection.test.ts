import { describe, expect, test } from 'bun:test';

import {
    buildRequestedOutputs,
    firstOutputError,
    initialOutputSelections,
    outputFormatKey,
    outputFormatLabel,
    setOutputFormat,
    setOutputSelected,
} from '../../resources/js/lib/process-output-selection';
import type {
    OgcNormalizedOutput,
    OgcOutputFormat,
} from '../../resources/js/types';

const jsonFormat: OgcOutputFormat = {
    label: 'JSON Array',
    mediaType: 'application/json',
};
const textFormat: OgcOutputFormat = {
    label: 'Plain text Array',
    mediaType: 'text/plain',
};
const chartFormat: OgcOutputFormat = {
    label: 'application/json',
    mediaType: 'application/json',
    schema: {
        type: 'object',
        required: ['series'],
    },
};
const outputs: Record<string, OgcNormalizedOutput> = {
    solwcad_out: {
        name: 'solwcad_out',
        title: 'Output result',
        formats: [jsonFormat, textFormat],
    },
    chart: {
        name: 'chart',
        title: 'Chart',
        formats: [chartFormat],
    },
    unqualified: {
        name: 'unqualified',
        title: 'Unqualified file',
        formats: [],
    },
};

describe('process output selection', () => {
    test('selects every output and the first advertised format initially', () => {
        expect(initialOutputSelections(outputs)).toEqual({
            solwcad_out: {
                selected: true,
                format: jsonFormat,
            },
            chart: {
                selected: true,
                format: chartFormat,
            },
            unqualified: {
                selected: true,
                format: null,
            },
        });
    });

    test('preserves the chosen format while deselecting and reselecting', () => {
        let selections = initialOutputSelections(outputs);

        selections = setOutputFormat(selections, 'solwcad_out', textFormat);
        selections = setOutputSelected(selections, 'solwcad_out', false);
        selections = setOutputSelected(selections, 'solwcad_out', true);

        expect(selections.solwcad_out).toEqual({
            selected: true,
            format: textFormat,
        });
    });

    test('serializes only selected outputs and removes display labels', () => {
        let selections = initialOutputSelections(outputs);

        selections = setOutputFormat(selections, 'solwcad_out', textFormat);
        selections = setOutputSelected(selections, 'chart', false);

        expect(buildRequestedOutputs(selections)).toEqual({
            solwcad_out: {
                format: {
                    mediaType: 'text/plain',
                },
            },
            unqualified: {},
        });
    });

    test('serializes no selected outputs as an empty object', () => {
        let selections = initialOutputSelections(outputs);

        for (const outputId of Object.keys(selections)) {
            selections = setOutputSelected(selections, outputId, false);
        }

        expect(buildRequestedOutputs(selections)).toEqual({});
    });

    test('keeps encoding and schema in the request qualifier', () => {
        const selections = {
            chart: {
                selected: true,
                format: {
                    ...chartFormat,
                    encoding: 'utf-8',
                },
            },
        };

        expect(buildRequestedOutputs(selections)).toEqual({
            chart: {
                format: {
                    mediaType: 'application/json',
                    encoding: 'utf-8',
                    schema: {
                        type: 'object',
                        required: ['series'],
                    },
                },
            },
        });
    });

    test('builds stable select keys and readable labels', () => {
        expect(outputFormatKey(jsonFormat)).toBe(
            outputFormatKey({ ...jsonFormat }),
        );
        expect(outputFormatLabel(jsonFormat)).toBe(
            'JSON Array — application/json',
        );
        expect(outputFormatLabel(chartFormat)).toBe('application/json');
    });

    test('returns the first nested output validation error', () => {
        expect(
            firstOutputError({
                name: 'Ignore',
                'outputs.solwcad_out.format':
                    'This output format is not available.',
            }),
        ).toBe('This output format is not available.');
        expect(firstOutputError({ inputs: 'Ignore' })).toBeUndefined();
    });
});
