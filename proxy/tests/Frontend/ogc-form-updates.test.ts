import { describe, expect, test } from 'bun:test';

import {
    appendFormRow,
    removeFormRow,
    updateFormProperty,
    updateFormRow,
    updateVariantProperty,
} from '../../resources/js/lib/ogc-form-updates';

describe('editing inputs during structural transitions', () => {
    test('keeps a pending row addition when another field is edited', () => {
        const renderedInputs = { rows: [{ name: 'first' }], title: '' };
        const withRow = updateFormProperty(
            renderedInputs,
            'rows',
            (rows: unknown) => appendFormRow(rows, { name: 'second' }),
        );
        const withTitle = updateFormProperty(withRow, 'title', 'My run');
        expect(withTitle).toEqual({
            rows: [{ name: 'first' }, { name: 'second' }],
            title: 'My run',
        });
    });

    test('keeps nested siblings when a group is edited before rendering catches up', () => {
        const inputs = { config: { rows: [], label: '' } };
        const withRow = updateFormProperty(
            inputs,
            'config',
            (config: unknown) =>
                updateFormProperty(config, 'rows', (rows: unknown) =>
                    appendFormRow(rows, {}),
                ),
        );
        const edited = updateFormProperty(
            withRow,
            'config',
            (config: unknown) => updateFormProperty(config, 'label', 'Updated'),
        );
        expect(edited).toEqual({ config: { rows: [{}], label: 'Updated' } });
    });

    test('targets the same row after another row was removed', () => {
        const renderedRows = [{ name: 'first' }, { name: 'second' }];
        const removed = removeFormRow(renderedRows, renderedRows[0]);
        const edited = updateFormRow(removed, renderedRows[1], (row: unknown) =>
            updateFormProperty(row, 'name', 'Changed'),
        );
        expect(edited).toEqual([{ name: 'Changed' }]);
        expect(updateFormRow(edited, renderedRows[0], { name: 'gone' })).toBe(
            edited,
        );
    });

    test('retains consecutive cell edits using the same rendered row', () => {
        const renderedRows = [['a', 'b']];
        const first = updateFormRow(renderedRows, renderedRows[0], [
            'new a',
            'b',
        ]);
        const second = updateFormRow(first, renderedRows[0], (row: unknown) => [
            (row as string[])[0],
            'new b',
        ]);
        expect(second).toEqual([['new a', 'new b']]);
        expect(removeFormRow(second, renderedRows[0])).toEqual([]);
    });

    test('checks row limits against the latest state for rapid clicks', () => {
        const first = {};
        const second = {};
        const rows = appendFormRow([first], second, 2);
        expect(appendFormRow(rows, {}, 2)).toBe(rows);
        const removed = removeFormRow(rows, first, 1);
        expect(removeFormRow(removed, second, 1)).toBe(removed);
    });

    test('does not let an old variant field overwrite the newly selected variant', () => {
        const current = { variant: 'new', value: { name: 'default' } };
        expect(
            updateVariantProperty(current, 'old', 'name', 'late typing'),
        ).toBe(current);
        expect(
            updateVariantProperty(current, 'new', 'name', 'updated'),
        ).toEqual({
            variant: 'new',
            value: { name: 'updated' },
        });
    });

    test('allows editing the default variant inside a newly added empty row', () => {
        expect(
            updateVariantProperty(undefined, 'default', 'name', 'first value'),
        ).toEqual({
            variant: 'default',
            value: { name: 'first value' },
        });
    });
});
