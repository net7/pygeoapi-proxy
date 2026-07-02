import ArrayObjectField from '@/components/ogc/array-object-field';
import ArrayTableField from '@/components/ogc/array-table-field';
import DataInputField from '@/components/ogc/data-input-field';
import OneOfField from '@/components/ogc/one-of-field';
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
import { htmlPatternForInput } from '@/lib/html-pattern';
import type { OgcNormalizedField } from '@/types';

export default function SchemaFieldRenderer({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    if (field.kind === 'object' && field.fields) {
        const objectValue = isRecord(value) ? value : {};

        return (
            <FieldSet className="max-w-full min-w-0">
                <FieldLegend>{field.title}</FieldLegend>
                <FieldGroup className="min-w-0">
                    {Object.entries(field.fields).map(([key, child]) => (
                        <SchemaFieldRenderer
                            key={key}
                            field={child}
                            value={objectValue[key]}
                            onChange={(nextValue) =>
                                onChange({ ...objectValue, [key]: nextValue })
                            }
                        />
                    ))}
                </FieldGroup>
            </FieldSet>
        );
    }

    if (field.kind === 'oneOf') {
        return <OneOfField field={field} value={value} onChange={onChange} />;
    }

    if (field.kind === 'array_object') {
        return (
            <ArrayObjectField field={field} value={value} onChange={onChange} />
        );
    }

    if (field.kind === 'array_table') {
        return (
            <ArrayTableField field={field} value={value} onChange={onChange} />
        );
    }

    if (isComplexInput(field)) {
        return (
            <DataInputField field={field} value={value} onChange={onChange} />
        );
    }

    if (field.kind === 'enum') {
        return (
            <Field className="min-w-0">
                <FieldLabel>{field.title}</FieldLabel>
                <Select
                    value={String(value ?? '')}
                    onValueChange={(selected) =>
                        onChange(enumValueFromString(field, selected))
                    }
                >
                    <SelectTrigger className="w-full min-w-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {field.options?.map((option) => (
                                <SelectItem
                                    key={String(option)}
                                    value={String(option)}
                                >
                                    {String(option)}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                {field.description ? (
                    <FieldDescription className="break-words">
                        {field.description}
                    </FieldDescription>
                ) : null}
            </Field>
        );
    }

    return (
        <Field className="min-w-0">
            <FieldLabel>{field.title}</FieldLabel>
            <Input
                className="min-w-0"
                type={
                    field.type === 'number' || field.type === 'integer'
                        ? 'number'
                        : 'text'
                }
                value={String(value ?? '')}
                min={field.minimum ?? field.exclusiveMinimum ?? undefined}
                max={field.maximum ?? field.exclusiveMaximum ?? undefined}
                step={field.type === 'number' ? 'any' : undefined}
                pattern={htmlPatternForInput({
                    type: field.type,
                    pattern: field.pattern,
                })}
                onChange={(event) => {
                    const raw = event.target.value;

                    if (raw === '') {
                        onChange(null);

                        return;
                    }

                    onChange(
                        field.type === 'number'
                            ? Number(raw)
                            : field.type === 'integer'
                              ? Number.parseInt(raw, 10)
                              : raw,
                    );
                }}
            />
            {field.description ? (
                <FieldDescription className="break-words">
                    {field.description}
                </FieldDescription>
            ) : null}
        </Field>
    );
}

function enumValueFromString(
    field: OgcNormalizedField,
    selected: string,
): unknown {
    return (
        field.options?.find((option) => String(option) === selected) ?? selected
    );
}

function isComplexInput(field: OgcNormalizedField): boolean {
    return Boolean(
        field.mediaType ||
        field.contentEncoding === 'binary' ||
        field.references?.length,
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
