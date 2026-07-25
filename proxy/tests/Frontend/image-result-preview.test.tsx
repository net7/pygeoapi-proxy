import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import ImageResultPreview from '../../resources/js/components/ogc/image-result-preview';

test('renders raster results responsively with accessible metadata', () => {
    const html = renderToStaticMarkup(
        <ImageResultPreview
            src="/jobs/12/results/34/preview"
            alt="PYBOX overlay"
        />,
    );

    expect(html).toContain('<img');
    expect(html).toContain('src="/jobs/12/results/34/preview"');
    expect(html).toContain('alt="PYBOX overlay"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('object-contain');
});
