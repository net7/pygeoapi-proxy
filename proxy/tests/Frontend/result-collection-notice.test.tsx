import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import ResultCollectionFailureNotice from '../../resources/js/components/ogc/result-collection-failure-notice';

test('result collection failure notice renders warning, technical detail, and retry action', () => {
    const html = renderToStaticMarkup(
        <ResultCollectionFailureNotice
            title="Results unavailable"
            description="The process completed, but its outputs could not be collected."
            error="Connection to result storage timed out."
            retryAction={<button type="button">Retry</button>}
        />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Results unavailable');
    expect(html).toContain(
        'The process completed, but its outputs could not be collected.',
    );
    expect(html).toContain('Connection to result storage timed out.');
    expect(html).toContain('<button type="button">Retry</button>');
    expect(html).toContain('border-warning-emphasis');
});
