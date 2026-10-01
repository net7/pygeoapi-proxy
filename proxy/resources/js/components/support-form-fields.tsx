import {
    File as FileIcon,
    FileImage,
    FileJson,
    FileSpreadsheet,
    FileTerminal,
    FileText,
    Send,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import { FieldRequirement } from '@/components/ogc/input-support';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { formatSupportAttachmentSize } from '@/lib/support-attachments';
import type { SupportFormValues, SupportLimits } from '@/types/support';

const attachmentIcons: Record<string, LucideIcon> = {
    png: FileImage,
    jpg: FileImage,
    jpeg: FileImage,
    webp: FileImage,
    pdf: FileText,
    txt: FileText,
    log: FileTerminal,
    csv: FileSpreadsheet,
    json: FileJson,
};

export type SupportFormFieldsProps = {
    values: SupportFormValues;
    errors: Record<string, string | undefined>;
    limits: SupportLimits;
    processing: boolean;
    progress: number | null;
    fileInput: RefObject<HTMLInputElement | null>;
    onTextChange: (
        field: 'subject' | 'description' | 'email',
        value: string,
    ) => void;
    onValidate: (field: 'subject' | 'description' | 'email') => void;
    onFilesSelected: (files: File[]) => void;
    onFileRemoved: (index: number) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SupportFormFields({
    values,
    errors,
    limits,
    processing,
    progress,
    fileInput,
    onTextChange,
    onValidate,
    onFilesSelected,
    onFileRemoved,
    onSubmit,
}: SupportFormFieldsProps) {
    const { t, locale } = useTranslation();
    const attachmentsAtLimit =
        values.attachments.length >= limits.maxAttachments;

    return (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            {errors.support && (
                <Alert variant="destructive">
                    <AlertDescription>{errors.support}</AlertDescription>
                </Alert>
            )}
            <FieldGroup className="gap-3">
                <Field
                    data-invalid={Boolean(errors.email)}
                    data-disabled={processing}
                >
                    <FieldLabel htmlFor="support-email">
                        {t('support.email')}
                        <FieldRequirement required={true} />
                    </FieldLabel>
                    <Input
                        id="support-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={255}
                        value={values.email}
                        disabled={processing}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby="support-email-hint support-email-error"
                        onChange={(event) =>
                            onTextChange('email', event.target.value)
                        }
                        onBlur={() => onValidate('email')}
                    />
                    <FieldDescription id="support-email-hint">
                        {t('support.emailHint')}
                    </FieldDescription>
                    <FieldError id="support-email-error">
                        {errors.email}
                    </FieldError>
                </Field>
                <Field
                    data-invalid={Boolean(errors.subject)}
                    data-disabled={processing}
                >
                    <FieldLabel htmlFor="support-subject">
                        {t('support.subject')}
                        <FieldRequirement required={true} />
                    </FieldLabel>
                    <Input
                        id="support-subject"
                        name="subject"
                        required
                        maxLength={200}
                        value={values.subject}
                        disabled={processing}
                        aria-invalid={Boolean(errors.subject)}
                        aria-describedby="support-subject-error"
                        onChange={(event) =>
                            onTextChange('subject', event.target.value)
                        }
                        onBlur={() => onValidate('subject')}
                    />
                    <FieldError id="support-subject-error">
                        {errors.subject}
                    </FieldError>
                </Field>
                <Field
                    data-invalid={Boolean(errors.description)}
                    data-disabled={processing}
                >
                    <FieldLabel htmlFor="support-description">
                        {t('support.description')}
                        <FieldRequirement required={true} />
                    </FieldLabel>
                    <Textarea
                        id="support-description"
                        name="description"
                        required
                        maxLength={10000}
                        rows={7}
                        value={values.description}
                        disabled={processing}
                        aria-invalid={Boolean(errors.description)}
                        aria-describedby="support-description-hint support-description-error"
                        onChange={(event) =>
                            onTextChange('description', event.target.value)
                        }
                        onBlur={() => onValidate('description')}
                    />
                    <FieldDescription id="support-description-hint">
                        {t('support.descriptionHint')}
                    </FieldDescription>
                    <FieldError id="support-description-error">
                        {errors.description}
                    </FieldError>
                </Field>
                <Field
                    data-invalid={Boolean(errors.attachments)}
                    data-disabled={processing}
                >
                    <FieldLabel htmlFor="support-attachments">
                        {t('support.attachments')}
                        <FieldRequirement required={false} />
                    </FieldLabel>
                    <Input
                        ref={fileInput}
                        id="support-attachments"
                        name="attachments[]"
                        type="file"
                        multiple
                        accept={limits.allowedExtensions
                            .map((extension) => '.' + extension)
                            .join(',')}
                        disabled={processing || attachmentsAtLimit}
                        aria-invalid={Boolean(errors.attachments)}
                        aria-describedby={`support-attachments-hint support-attachments-error${attachmentsAtLimit ? ' support-attachments-limit' : ''}`}
                        onChange={(event) => {
                            onFilesSelected(
                                Array.from(event.target.files ?? []),
                            );
                            event.target.value = '';
                        }}
                    />
                    <FieldDescription id="support-attachments-hint">
                        {t('support.attachmentLimits', {
                            count: limits.maxAttachments,
                            size: limits.maxFileBytes / 1024 / 1024,
                        })}{' '}
                        {limits.allowedExtensions.join(', ').toUpperCase()}.
                    </FieldDescription>
                    {attachmentsAtLimit && (
                        <FieldDescription
                            id="support-attachments-limit"
                            role="status"
                        >
                            {t('support.attachmentLimitReached', {
                                count: limits.maxAttachments,
                            })}
                        </FieldDescription>
                    )}
                    <FieldError id="support-attachments-error">
                        {errors.attachments}
                    </FieldError>
                    {values.attachments.length > 0 && (
                        <ul className="flex min-w-0 flex-col gap-1.5">
                            {values.attachments.map((file, index) => {
                                const extension = file.name
                                    .split('.')
                                    .pop()
                                    ?.toLowerCase();
                                const AttachmentIcon =
                                    attachmentIcons[extension ?? ''] ??
                                    FileIcon;

                                return (
                                    <li
                                        key={index}
                                        className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                                    >
                                        <AttachmentIcon
                                            className="size-4 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <p
                                            className="truncate text-sm font-medium"
                                            title={file.name}
                                        >
                                            {file.name}
                                        </p>
                                        <span
                                            className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
                                            title={`${file.size.toLocaleString(locale)} B`}
                                        >
                                            {formatSupportAttachmentSize(
                                                file.size,
                                                locale,
                                            )}
                                        </span>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="size-7 text-muted-foreground hover:text-destructive-emphasis"
                                            disabled={processing}
                                            aria-label={t(
                                                'support.removeFile',
                                                {
                                                    name: file.name,
                                                },
                                            )}
                                            onClick={() => onFileRemoved(index)}
                                        >
                                            <X data-icon="icon" />
                                        </Button>
                                        <FieldError className="col-start-2 col-end-5">
                                            {errors['attachments.' + index]}
                                        </FieldError>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Field>
            </FieldGroup>
            <div aria-live="polite">
                {progress !== null && (
                    <p className="mb-3 text-sm text-muted-foreground">
                        {t('support.uploadProgress', { percent: progress })}
                    </p>
                )}
                <Button type="submit" disabled={processing}>
                    {processing ? (
                        <Spinner data-icon="inline-start" />
                    ) : (
                        <Send data-icon="inline-start" />
                    )}
                    {t(processing ? 'support.sending' : 'support.send')}
                </Button>
            </div>
        </form>
    );
}
