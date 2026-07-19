import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Table } from '../../resources/js/components/ui/table';

describe('Table', () => {
    test('forwards accessible props and classes to the scroll container', () => {
        const html = renderToStaticMarkup(
            <Table
                containerClassName="focus-visible:ring-2"
                containerProps={{
                    role: 'region',
                    'aria-label': 'Editable data',
                    tabIndex: 0,
                }}
            >
                <tbody>
                    <tr>
                        <td>Value</td>
                    </tr>
                </tbody>
            </Table>,
        );

        expect(html).toContain('data-slot="table-container"');
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="Editable data"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('focus-visible:ring-2');
        expect(html).toContain('overflow-x-auto');
        expect(html).toContain('<table data-slot="table"');
    });
});
