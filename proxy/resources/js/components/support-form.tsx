import { useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ContentTransition } from '@/components/content-transition';
import { SupportFormFields } from '@/components/support-form-fields';
import { SupportSubmissionFeedback } from '@/components/support-submission-feedback';
import { useTranslation } from '@/hooks/use-translation';
import { runUiTransition } from '@/lib/motion';
import { selectSupportAttachments } from '@/lib/support-attachments';
import { collectSupportClientContext } from '@/lib/support-client-context';
import { store } from '@/routes/support';
import type { SupportFormValues, SupportLimits } from '@/types/support';

export type SupportFormProps = {
    initialEmail: string;
    limits: SupportLimits;
    onClose: () => void;
    onProcessingChange: (processing: boolean) => void;
};

type SubmissionView =
    | { status: 'form' }
    | {
          status: 'sending' | 'success' | 'error';
          email: string;
          error?: string;
      };

const attachmentErrorKeys = {
    count: 'support.fileError.count',
    size: 'support.fileError.size',
    extension: 'support.fileError.extension',
} as const;

export function SupportForm({
    initialEmail,
    limits,
    onClose,
    onProcessingChange,
}: SupportFormProps) {
    const { t } = useTranslation();
    const fileInput = useRef<HTMLInputElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const submitting = useRef(false);
    const hasSubmitted = useRef(false);
    const [view, setView] = useState<SubmissionView>({ status: 'form' });
    const form = useForm<SupportFormValues>(store(), {
        subject: '',
        description: '',
        email: initialEmail,
        attachments: [],
    });

    useEffect(() => {
        if (view.status === 'form' && hasSubmitted.current) {
            const target =
                content.current?.querySelector<HTMLElement>(
                    '[aria-invalid="true"]',
                ) ??
                content.current?.querySelector<HTMLInputElement>(
                    '#support-subject',
                );
            target?.focus();
        }
    }, [view]);

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

        if (submitting.current || form.processing) {
            return;
        }

        submitting.current = true;
        hasSubmitted.current = true;
        const email = form.data.email.trim();
        const showError = (error = t('support.failureDescription')) => {
            runUiTransition(() => setView({ status: 'error', email, error }));
        };

        form.transform((data) => ({
            ...data,
            technical_context: collectSupportClientContext(),
        }));

        try {
            form.submit({
                preserveScroll: true,
                onStart: () => {
                    onProcessingChange(true);
                    runUiTransition(() =>
                        setView({ status: 'sending', email }),
                    );
                },
                onSuccess: () => {
                    runUiTransition(() => {
                        form.reset('subject', 'description', 'attachments');
                        setView({ status: 'success', email });
                    });
                },
                onError: (errors) => {
                    if (errors.support) {
                        showError(errors.support);
                    } else {
                        runUiTransition(() => setView({ status: 'form' }));
                    }
                },
                onHttpException: () => {
                    showError();

                    return false;
                },
                onNetworkError: () => {
                    showError();

                    return false;
                },
                onCancel: () => showError(),
                onFinish: () => {
                    submitting.current = false;
                    onProcessingChange(false);
                },
            });
        } finally {
            form.transform((data) => data);
        }
    }

    return (
        <ContentTransition>
            <div ref={content} className="grid min-w-0">
                {view.status === 'form' ? (
                    <SupportFormFields
                        values={form.data}
                        errors={form.errors}
                        limits={limits}
                        processing={form.processing}
                        progress={form.progress?.percentage ?? null}
                        fileInput={fileInput}
                        onTextChange={(field, value) =>
                            form.setData(field, value)
                        }
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
                ) : (
                    <SupportSubmissionFeedback
                        status={view.status}
                        email={view.email}
                        error={view.error}
                        progress={form.progress?.percentage ?? null}
                        onClose={onClose}
                        onEdit={() => {
                            runUiTransition(() => {
                                form.clearErrors();
                                setView({ status: 'form' });
                            });
                        }}
                    />
                )}
            </div>
        </ContentTransition>
    );
}
