import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupportFormFields } from '../../resources/js/components/support-form-fields';
import type { SupportFormFieldsProps } from '../../resources/js/components/support-form-fields';

const props: SupportFormFieldsProps = {
    values: {
        email: 'editable@example.org',
        subject: 'Help',
        description: 'Details',
        attachments: [new File(['data'], 'trace.log')],
    },
    errors: {},
    limits: {
        maxAttachments: 3,
        maxFileBytes: 5242880,
        allowedExtensions: ['log', 'pdf'],
    },
    processing: false,
    progress: null,
    fileInput: { current: null },
    onTextChange: () => {},
    onValidate: () => {},
    onFilesSelected: () => {},
    onFileRemoved: () => {},
    onSubmit: () => {},
};

test('the form renders an editable email and labels linked to each control', () => {
    const html = renderToStaticMarkup(<SupportFormFields {...props} />);

    for (const field of ['email', 'subject', 'description', 'attachments']) {
        expect(html).toContain('for="support-' + field + '"');
        expect(html).toContain('id="support-' + field + '"');
    }

    expect(html).toContain('value="editable@example.org"');
    expect(html).not.toContain('readOnly');
    expect(html).toContain('3');
    expect(html).toContain('5 MB');
    expect(html).toContain('accept=".log,.pdf"');
    expect(html).toContain('aria-label="Remove trace.log"');
});

test('field and attachment errors are associated and user input is escaped', () => {
    const html = renderToStaticMarkup(
        <SupportFormFields
            {...props}
            errors={{
                email: 'Email invalid',
                'attachments.0': 'File invalid',
                support: 'Please retry',
            }}
            values={{ ...props.values, subject: '<script>alert(1)</script>' }}
        />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('support-email-error');
    expect(html).toContain('Email invalid');
    expect(html).toContain('File invalid');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Please retry');
    expect(html).not.toContain('<script>');
});

test('submission is disabled during upload and progress is announced', () => {
    const html = renderToStaticMarkup(
        <SupportFormFields {...props} processing progress={42} />,
    );
    const button = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
    expect(button).toContain('disabled');
    expect(html).toContain('42');
    expect(html).toContain('aria-live="polite"');
});
