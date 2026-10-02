import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupportSubmissionFeedback } from '../../resources/js/components/support-submission-feedback';

const actions = { onEdit: () => {}, onClose: () => {} };

test('sending replaces editable controls with an announced loader and actual upload progress', () => {
    const html = renderToStaticMarkup(
        <SupportSubmissionFeedback
            {...actions}
            status="sending"
            email="reply@example.org"
            progress={42}
        />,
    );

    expect(html).toContain('Sending');
    expect(html).toContain('role="status"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Request accepted');
});

test('success explains acceptance and displays the chosen reply email without claiming delivery', () => {
    const html = renderToStaticMarkup(
        <SupportSubmissionFeedback
            {...actions}
            status="success"
            email="reply@example.org"
        />,
    );

    expect(html).toContain('Request accepted');
    expect(html).toContain('reply@example.org');
    expect(html).toContain('Replies will be sent to');
    expect(html).toContain('Close');
    expect(html).not.toContain('delivered');
    expect(html).not.toContain('<form');
});

test('failure explains the outcome and offers a return to the preserved request', () => {
    const html = renderToStaticMarkup(
        <SupportSubmissionFeedback
            {...actions}
            status="error"
            email="reply@example.org"
            error="Please wait before trying again."
        />,
    );

    expect(html).toContain('Send not confirmed');
    expect(html).toContain('Please wait before trying again.');
    expect(html).toContain('Back to request');
    expect(html).not.toContain('Request accepted');
    expect(html).not.toContain('role="progressbar"');
});
