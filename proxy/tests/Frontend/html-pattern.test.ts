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

    test('normalizes legacy sign classes and omits unsupported posix classes', () => {
        expect(
            htmlPatternForInput({
                type: 'string',
                pattern: solwcadDecimalPattern,
            }),
        ).toBe('^([+\\-]?([\\d]+\\.|[\\d]*\\.[\\d]+))([Dd][+\\-]?[\\d]+)?$');

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
        ).toBe('^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$');

        expect(
            htmlPatternForInput({
                type: 'string',
                pattern:
                    '^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$',
            }),
        ).toBe('^[+\\-]?(?:[0-9]+\\.|[0-9]*\\.[0-9]+)(?:[Dd][+\\-]?[0-9]+)?$');
    });
});
