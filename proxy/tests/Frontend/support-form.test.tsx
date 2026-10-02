import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupportFormFields } from '../../resources/js/components/support-form-fields';
import type { SupportFormFieldsProps } from '../../resources/js/components/support-form-fields';

const props: SupportFormFieldsProps = {
    values: {
        email: 'editable@example.org',
        subject: 'Help',
        description: 'Details of the issue',
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
    expect(html).toContain('id="support-technical-notice"');
    expect(html).toContain('browser and operating system');
    expect(html).toContain('solely to diagnose and resolve the issue');
    expect(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toContain(
        'aria-describedby="support-technical-notice"',
    );
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
    expect(button).toMatch(/\sdisabled=""/);
    expect(html).toContain('42');
    expect(html).toContain('aria-live="polite"');
});

test.each([
    ['email', ''],
    ['subject', ''],
    ['description', ''],
    ['email', '   '],
    ['subject', '   '],
    ['description', ' \n\t '],
] as const)(
    'submission is disabled when %s contains only %j',
    (field, value) => {
        const html = renderToStaticMarkup(
            <SupportFormFields
                {...props}
                values={{ ...props.values, [field]: value }}
            />,
        );

        expect(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toMatch(
            /\sdisabled=""/,
        );
    },
);

test('completed required fields enable submission without requiring attachments', () => {
    const html = renderToStaticMarkup(
        <SupportFormFields
            {...props}
            values={{
                ...props.values,
                description: '1234567890',
                attachments: [],
            }}
        />,
    );

    expect(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).not.toMatch(
        /\sdisabled=""/,
    );
    expect(html.match(/<form[^>]*>/)?.[0]).not.toMatch(/\snovalidate[\s=>]/i);
    expect(html.match(/<input[^>]*id="support-email"[^>]*>/)?.[0]).toContain(
        'type="email"',
    );
    expect(html.match(/<input[^>]*id="support-subject"[^>]*>/)?.[0]).toMatch(
        /maxlength="200"/i,
    );
    expect(
        html.match(/<textarea[^>]*id="support-description"[^>]*>/)?.[0],
    ).toMatch(/minlength="10"/i);
});

test.each(['123456789', ' 123456789 ', '😀😀😀😀😀😀😀😀😀'])(
    'submission is disabled when the trimmed description is shorter than ten characters: %j',
    (description) => {
        const html = renderToStaticMarkup(
            <SupportFormFields
                {...props}
                values={{ ...props.values, description }}
            />,
        );

        expect(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toMatch(
            /\sdisabled=""/,
        );
    },
);

test('the full attachment list disables selection with an explanation but permits removal', () => {
    const attachments = ['a.log', 'b.log', 'c.log'].map(
        (name) => new File(['trace'], name),
    );
    const html = renderToStaticMarkup(
        <SupportFormFields
            {...props}
            values={{ ...props.values, attachments }}
        />,
    );
    const uploader = html.match(
        /<input[^>]*id="support-attachments"[^>]*>/,
    )?.[0];
    const removeButtons = html.match(
        /<button[^>]*aria-label="Remove [^"]+"[^>]*>/g,
    );

    expect(uploader).toMatch(/\sdisabled=""/);
    expect(uploader).toContain('support-attachments-limit');
    expect(html).toContain('You have reached the limit of 3 attachments.');
    expect(html).toContain('Remove a file to add another.');
    expect(removeButtons).toHaveLength(3);

    for (const button of removeButtons ?? []) {
        expect(button).not.toMatch(/\sdisabled=""/);
    }

    const afterRemoval = renderToStaticMarkup(
        <SupportFormFields
            {...props}
            values={{ ...props.values, attachments: attachments.slice(1) }}
        />,
    );
    expect(
        afterRemoval.match(/<input[^>]*id="support-attachments"[^>]*>/)?.[0],
    ).not.toMatch(/\sdisabled=""/);
    expect(afterRemoval).not.toContain('support-attachments-limit');
});
