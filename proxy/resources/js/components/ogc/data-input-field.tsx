import { useState } from 'react';

import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/ui/field';
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
import type { OgcNormalizedField } from '@/types';

type InputMode = 'inline' | 'reference' | 'upload';

export default function DataInputField({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const [mode, setMode] = useState<InputMode>(() =>
        initialMode(value, field),
    );
    const selectedReference = isHrefValue(value) ? value.href : '';

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
        <FieldSet>
            <FieldLegend>{field.title}</FieldLegend>
            {field.description ? (
                <FieldDescription>{field.description}</FieldDescription>
            ) : null}

            <ToggleGroup type="single" value={mode} onValueChange={changeMode}>
                <ToggleGroupItem value="inline">Inline</ToggleGroupItem>
                <ToggleGroupItem value="reference">URL</ToggleGroupItem>
                <ToggleGroupItem value="upload">Upload</ToggleGroupItem>
            </ToggleGroup>

            <FieldGroup>
                {mode === 'inline' ? (
                    <Field>
                        <FieldLabel>Value</FieldLabel>
                        <Textarea
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
                    <Field>
                        <FieldLabel>Reference URL</FieldLabel>
                        {field.references && field.references.length > 0 ? (
                            <Select
                                value={selectedReference || undefined}
                                onValueChange={setReference}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {field.references.map((reference) => (
                                            <SelectItem
                                                key={reference.href}
                                                value={reference.href}
                                            >
                                                {reference.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        ) : null}
                        <Input
                            type="url"
                            value={selectedReference}
                            onChange={(event) =>
                                setReference(event.target.value)
                            }
                        />
                    </Field>
                ) : null}

                {mode === 'upload' ? (
                    <Field>
                        <FieldLabel>File</FieldLabel>
                        <Input
                            type="file"
                            accept={field.mediaType ?? undefined}
                            onChange={(event) =>
                                readFile(event.target.files?.item(0) ?? null)
                            }
                        />
                    </Field>
                ) : null}
            </FieldGroup>
        </FieldSet>
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
