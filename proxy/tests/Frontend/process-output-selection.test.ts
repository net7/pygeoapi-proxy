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

    test('returns the same state when selecting unknown outputs', () => {
        const selections = initialOutputSelections(outputs);

        for (const outputId of ['missing', 'constructor', 'toString']) {
            expect(setOutputSelected(selections, outputId, false)).toBe(
                selections,
            );
        }
    });

    test('returns the same state when formatting unknown outputs', () => {
        const selections = initialOutputSelections(outputs);

        for (const outputId of ['missing', 'constructor', 'toString']) {
            expect(setOutputFormat(selections, outputId, textFormat)).toBe(
                selections,
            );
        }
    });

    test('updates selection without mutating the original state', () => {
        const selections = initialOutputSelections(outputs);
        const originalSelection = selections.solwcad_out;

        const updated = setOutputSelected(selections, 'solwcad_out', false);

        expect(updated).not.toBe(selections);
        expect(updated.solwcad_out).not.toBe(originalSelection);
        expect(selections.solwcad_out).toEqual({
            selected: true,
            format: jsonFormat,
        });
        expect(updated.solwcad_out).toEqual({
            selected: false,
            format: jsonFormat,
        });
    });

    test('updates format without mutating the original state', () => {
        const selections = initialOutputSelections(outputs);
        const originalSelection = selections.solwcad_out;

        const updated = setOutputFormat(selections, 'solwcad_out', textFormat);

        expect(updated).not.toBe(selections);
        expect(updated.solwcad_out).not.toBe(originalSelection);
        expect(selections.solwcad_out).toEqual({
            selected: true,
            format: jsonFormat,
        });
        expect(updated.solwcad_out).toEqual({
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

    test('serializes a present empty encoding', () => {
        const selections = {
            solwcad_out: {
                selected: true,
                format: {
                    ...jsonFormat,
                    encoding: '',
                },
            },
        };

        expect(buildRequestedOutputs(selections)).toEqual({
            solwcad_out: {
                format: {
                    mediaType: 'application/json',
                    encoding: '',
                },
            },
        });
    });

    test('does not serialize browser-only transmission mode state', () => {
        const selections = {
            chart: {
                selected: true,
                format: {
                    ...chartFormat,
                    transmissionMode: 'reference',
                },
            },
        };

        expect(buildRequestedOutputs(selections)).toEqual({
            chart: {
                format: {
                    mediaType: 'application/json',
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

    test('canonicalizes nested schema key order for stable select keys', () => {
        const firstFormat: OgcOutputFormat = {
            label: 'Chart',
            mediaType: 'application/json',
            schema: {
                type: 'object',
                properties: {
                    series: { type: 'array' },
                    title: { type: 'string' },
                },
            },
        };
        const secondFormat: OgcOutputFormat = {
            label: 'Chart',
            mediaType: 'application/json',
            schema: {
                properties: {
                    title: { type: 'string' },
                    series: { type: 'array' },
                },
                type: 'object',
            },
        };

        expect(outputFormatKey(firstFormat)).toBe(
            outputFormatKey(secondFormat),
        );
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

    test('returns the direct outputs validation error first', () => {
        expect(
            firstOutputError({
                outputs: 'Select at least one output.',
                'outputs.solwcad_out.format':
                    'This output format is not available.',
            }),
        ).toBe('Select at least one output.');
    });

    test('skips empty output validation errors', () => {
        expect(
            firstOutputError({
                outputs: '',
                'outputs.solwcad_out': undefined,
                'outputs.chart.format': 'This output format is not available.',
            }),
        ).toBe('This output format is not available.');
    });
});
