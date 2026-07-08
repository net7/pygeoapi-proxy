import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

import {
    copyableRawText,
    jsonPreviewValue,
} from '../../resources/js/lib/raw-preview';

describe('raw preview helpers', () => {
    test('keeps text and csv payloads unchanged for copy all', () => {
        expect(copyableRawText('plain text')).toBe('plain text');
        expect(copyableRawText('a,b\n1,2')).toBe('a,b\n1,2');
    });

    test('serializes structured csv previews as csv for copy all', () => {
        expect(
            copyableRawText(
                {
                    headers: ['name', 'value'],
                    rows: [
                        ['alpha', '1'],
                        ['quoted, value', '"2"'],
                    ],
                },
                'csv',
            ),
        ).toBe('name,value\nalpha,1\n"quoted, value","""2"""');
    });

    test('formats object payloads as pretty json for copy all', () => {
        expect(copyableRawText({ inputs: { distance: 12 } })).toBe(
            '{\n  "inputs": {\n    "distance": 12\n  }\n}',
        );
    });

    test('normalizes json strings and objects for the json viewer', () => {
        expect(jsonPreviewValue('{"status":"ok","values":[1,2]}')).toEqual({
            status: 'ok',
            values: [1, 2],
        });
        expect(jsonPreviewValue([{ id: 1 }])).toEqual([{ id: 1 }]);
        expect(jsonPreviewValue('not json')).toBeNull();
        expect(jsonPreviewValue('42')).toBeNull();
    });
});

describe('raw preview wiring', () => {
    test('uses uiw react json view with nord theme and one copy button', () => {
        const source = readFileSync(
            'resources/js/components/ogc/raw-payload-block.tsx',
            'utf8',
        );

        expect(source).toContain("import JsonView from '@uiw/react-json-view'");
        expect(source).toContain(
            "import { nordTheme } from '@uiw/react-json-view/nord'",
        );
        expect(source).toContain('style={nordTheme}');
        expect(source).toContain('enableClipboard={false}');
        expect(source).toContain("t('common.copy')");
        expect(source).toContain('CopyIcon');
    });

    test('renders the copied output name in bold inside the copy notification', () => {
        const source = readFileSync(
            'resources/js/components/ogc/raw-payload-block.tsx',
            'utf8',
        );

        expect(source).toContain('copyLabel?: string');
        expect(source).toContain('<strong>{copyLabel}</strong>');
    });

    test('uses the shared raw payload block for output previews and input payloads', () => {
        const resultPreview = readFileSync(
            'resources/js/components/ogc/result-preview.tsx',
            'utf8',
        );
        const showPage = readFileSync(
            'resources/js/pages/process-executions/show.tsx',
            'utf8',
        );

        expect(resultPreview).toContain(
            "import RawPayloadBlock from '@/components/ogc/raw-payload-block'",
        );
        expect(resultPreview).toContain('kind="csv"');
        expect(resultPreview).toContain('kind="text"');
        expect(resultPreview).toContain('kind="json"');
        expect(resultPreview).toContain(
            'copyLabel={result.title ?? result.outputId}',
        );
        expect(showPage).toContain(
            "import RawPayloadBlock from '@/components/ogc/raw-payload-block'",
        );
        expect(showPage).toContain('kind="json"');
        expect(showPage).toContain('defaultOpen={false}');
        expect(showPage.indexOf("title={t('jobs.inputs')}")).toBeLessThan(
            showPage.indexOf("title={t('ogc.outputs')}"),
        );
        expect(showPage).not.toContain('function JsonBlock');
    });
});
