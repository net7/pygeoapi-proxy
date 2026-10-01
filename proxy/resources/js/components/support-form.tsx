import { useForm } from '@inertiajs/react';
import { useRef } from 'react';
import type { FormEvent } from 'react';
import { SupportFormFields } from '@/components/support-form-fields';
import { useTranslation } from '@/hooks/use-translation';
import { selectSupportAttachments } from '@/lib/support-attachments';
import { store } from '@/routes/support';
import type { SupportFormValues, SupportLimits } from '@/types/support';

export type SupportFormProps = { initialEmail: string; limits: SupportLimits };

const attachmentErrorKeys = {
    count: 'support.fileError.count',
    size: 'support.fileError.size',
    extension: 'support.fileError.extension',
} as const;

export function SupportForm({ initialEmail, limits }: SupportFormProps) {
    const { t } = useTranslation();
    const fileInput = useRef<HTMLInputElement>(null);
    const form = useForm<SupportFormValues>(store(), {
        subject: '',
        description: '',
        email: initialEmail,
        attachments: [],
    });

    function clearAttachmentErrors() {
        const keys = Object.keys(form.errors).filter(
            (key) => key === 'attachments' || key.startsWith('attachments.'),
        );

        if (keys.length) {
            form.clearErrors(...(keys as Array<keyof SupportFormValues>));
        }
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (form.processing) {
            return;
        }

        form.submit({
            preserveScroll: true,
            onSuccess: () => {
                form.reset('subject', 'description', 'attachments');

                if (fileInput.current) {
                    fileInput.current.value = '';
                }
            },
        });
    }

    return (
        <SupportFormFields
            values={form.data}
            errors={form.errors}
            limits={limits}
            processing={form.processing}
            progress={form.progress?.percentage ?? null}
            fileInput={fileInput}
            onTextChange={(field, value) => form.setData(field, value)}
            onValidate={(field) => form.validate(field)}
            onFilesSelected={(incoming) => {
                const selected = selectSupportAttachments(
                    form.data.attachments,
                    incoming,
                    limits,
                );
                clearAttachmentErrors();

                if (selected.ok) {
                    form.setData('attachments', selected.files);
                } else {
                    form.setError(
                        'attachments',
                        t(attachmentErrorKeys[selected.reason], {
                            count: limits.maxAttachments,
                            size: limits.maxFileBytes / 1024 / 1024,
                            name: selected.fileName ?? '',
                        }),
                    );
                }
            }}
            onFileRemoved={(index) => {
                clearAttachmentErrors();
                form.setData(
                    'attachments',
                    form.data.attachments.filter(
                        (_, position) => position !== index,
                    ),
                );

                if (fileInput.current) {
                    fileInput.current.value = '';
                }
            }}
            onSubmit={submit}
        />
    );
}
