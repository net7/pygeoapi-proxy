import { describe, expect, test } from 'bun:test';

import { htmlPatternForInput } from '../../resources/js/lib/html-pattern';

const solwcadDecimalPattern =
    '^([+-]?([\\d]+\\.|[\\d]*\\.[\\d]+))([Dd][+-]?[\\d]+)?$';
const solwcadPosixDecimalPattern =
    '^([+-]?(?:[[:digit:]]+\\.|[[:digit:]]*\\.[[:digit:]]+))(?:[Dd][+-]?[[:digit:]]+)?$';

describe('htmlPatternForInput', () => {
    test('omits schema patterns from numeric inputs', () => {
        expect(
            htmlPatternForInput({
                type: 'number',
                pattern: solwcadDecimalPattern,
            }),
        ).toBeUndefined();

        expect(
            htmlPatternForInput({
                type: 'integer',
                pattern: solwcadDecimalPattern,
            }),
        ).toBeUndefined();
    });

    test('omits patterns that the browser cannot compile for the pattern attribute', () => {
        expect(
            htmlPatternForInput({
                type: 'string',
                pattern: solwcadDecimalPattern,
            }),
        ).toBeUndefined();

        expect(
            htmlPatternForInput({
                type: 'string',
                pattern: solwcadPosixDecimalPattern,
            }),
        ).toBeUndefined();
    });

    test('keeps browser compatible text patterns', () => {
        expect(
            htmlPatternForInput({
                type: 'string',
                pattern: '[0-9]*',
            }),
        ).toBe('[0-9]*');
    });

    test('requires an escaped hyphen for browser v flag character classes', () => {
        expect(
            htmlPatternForInput({
                type: 'string',
                pattern:
                    '^[+-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+-]?[0-9]+)?$',
            }),
        ).toBeUndefined();

        expect(
            htmlPatternForInput({
                type: 'string',
                pattern:
                    '^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$',
            }),
        ).toBe('^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$');
    });
});
