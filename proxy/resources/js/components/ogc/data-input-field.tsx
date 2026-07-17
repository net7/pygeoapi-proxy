import { useState } from 'react';

import InputError from '@/components/input-error';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel, referenceDisplayLabel } from '@/lib/ogc-fields';
import { errorIdForPath, fieldError } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
import type { OgcNormalizedField } from '@/types';

type InputMode = 'inline' | 'reference' | 'upload';

export default function DataInputField({
    field,
    value,
    onChange,
    path,
    errors,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    errors: OgcFormErrors;
}) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<InputMode>(() =>
        initialMode(value, field),
    );
    const selectedReference = isHrefValue(value) ? value.href : '';
    const error = fieldError(errors, path);
    const errorId = errorIdForPath(path);

    function changeMode(nextMode: string) {
        if (
            nextMode === 'inline' ||
            nextMode === 'reference' ||
            nextMode === 'upload'
        ) {
            setMode(nextMode);
        }
    }

    function setReference(href: string) {
        const reference = field.references?.find(
            (option) => option.href === href,
        );

        onChange({
            href,
            type: reference?.mediaType ?? field.mediaType ?? undefined,
        });
    }

    function readFile(file: File | null) {
        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result ?? '');

            if (isBinaryInput(field, file)) {
                onChange({
                    value: result.includes(',') ? result.split(',')[1] : result,
                    mediaType: file.type || field.mediaType || undefined,
                    encoding: 'base64',
                });

                return;
            }

            onChange(qualifiedValue(field, result));
        };

        if (isBinaryInput(field, file)) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    }

    return (
        <SectionFieldSet
            label={fieldDisplayLabel(field)}
            description={field.description}
        >
            <ToggleGroup
                type="single"
                value={mode}
                onValueChange={changeMode}
                className="flex-wrap justify-start"
            >
                <ToggleGroupItem value="inline">
                    {t('ogc.inline')}
                </ToggleGroupItem>
                <ToggleGroupItem value="reference">URL</ToggleGroupItem>
                <ToggleGroupItem value="upload">
                    {t('ogc.upload')}
                </ToggleGroupItem>
            </ToggleGroup>

            <FieldGroup className="min-w-0">
                {mode === 'inline' ? (
                    <Field className="min-w-0">
                        <FieldLabel>{t('ogc.value')}</FieldLabel>
                        <Textarea
                            className="min-w-0"
                            data-field-path={path}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            value={inlineValue(value)}
                            onChange={(event) =>
                                onChange(
                                    qualifiedValue(field, event.target.value),
                                )
                            }
                        />
                    </Field>
                ) : null}

                {mode === 'reference' ? (
                    <Field className="min-w-0">
                        <FieldLabel>{t('ogc.referenceUrl')}</FieldLabel>
                        {field.references && field.references.length > 0 ? (
                            <Select
                                value={selectedReference || undefined}
                                onValueChange={setReference}
                            >
                                <SelectTrigger
                                    className="w-full min-w-0"
                                    data-field-path={path}
                                    aria-invalid={error ? true : undefined}
                                    aria-describedby={
                                        error ? errorId : undefined
                                    }
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {field.references.map((reference) => (
                                            <SelectItem
                                                key={reference.href}
                                                value={reference.href}
                                            >
                                                {referenceDisplayLabel(
                                                    reference,
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        ) : null}
                        <Input
                            type="url"
                            className="min-w-0"
                            data-field-path={path}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            value={selectedReference}
                            onChange={(event) =>
                                setReference(event.target.value)
                            }
                        />
                    </Field>
                ) : null}

                {mode === 'upload' ? (
                    <Field className="min-w-0">
                        <FieldLabel>{t('ogc.file')}</FieldLabel>
                        <Input
                            type="file"
                            className="min-w-0"
                            data-field-path={path}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            accept={field.mediaType ?? undefined}
                            onChange={(event) =>
                                readFile(event.target.files?.item(0) ?? null)
                            }
                        />
                    </Field>
                ) : null}
            </FieldGroup>
            <InputError id={errorId} message={error} />
        </SectionFieldSet>
    );
}

function initialMode(value: unknown, field: OgcNormalizedField): InputMode {
    if (isHrefValue(value)) {
        return 'reference';
    }

    return field.references?.length ? 'reference' : 'inline';
}

function qualifiedValue(
    field: OgcNormalizedField,
    rawValue: string,
): Record<string, unknown> {
    return {
        value: parseJsonIfNeeded(field, rawValue),
        mediaType: field.mediaType ?? undefined,
        encoding:
            field.contentEncoding && field.contentEncoding !== 'binary'
                ? field.contentEncoding
                : undefined,
    };
}

function parseJsonIfNeeded(
    field: OgcNormalizedField,
    rawValue: string,
): unknown {
    if (!field.mediaType?.includes('json')) {
        return rawValue;
    }

    try {
        return JSON.parse(rawValue);
    } catch {
        return rawValue;
    }
}

function inlineValue(value: unknown): string {
    if (isQualifiedValue(value)) {
        return typeof value.value === 'string'
            ? value.value
            : JSON.stringify(value.value, null, 2);
    }

    return typeof value === 'string' ? value : '';
}

function isBinaryInput(field: OgcNormalizedField, file: File): boolean {
    return (
        field.contentEncoding === 'binary' ||
        Boolean(
            field.mediaType &&
            !field.mediaType.includes('json') &&
            !field.mediaType.startsWith('text/'),
        ) ||
        Boolean(
            file.type &&
            !file.type.includes('json') &&
            !file.type.startsWith('text/'),
        )
    );
}

function isHrefValue(value: unknown): value is { href: string; type?: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'href' in value &&
        typeof value.href === 'string'
    );
}

function isQualifiedValue(value: unknown): value is { value: unknown } {
    return typeof value === 'object' && value !== null && 'value' in value;
}
