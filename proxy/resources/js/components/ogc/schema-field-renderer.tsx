import InputError from '@/components/input-error';
import ArrayObjectField from '@/components/ogc/array-object-field';
import ArrayTableField from '@/components/ogc/array-table-field';
import DataInputField from '@/components/ogc/data-input-field';
import OneOfField from '@/components/ogc/one-of-field';
import SectionFieldSet from '@/components/ogc/section-field-set';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
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
import { fieldDisplayLabel, optionDisplayLabel } from '@/lib/ogc-fields';
import { errorIdForPath, fieldError } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
import type { OgcNormalizedField } from '@/types';

export default function SchemaFieldRenderer({
    field,
    value,
    onChange,
    path,
    errors,
    topLevel = false,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    errors: OgcFormErrors;
    topLevel?: boolean;
}) {
    if (field.kind === 'object' && field.fields) {
        const objectValue = isRecord(value) ? value : {};
        const objectPath = topLevel ? path + '.value' : path;
        const error = fieldError(errors, path);

        return (
            <SectionFieldSet
                label={fieldDisplayLabel(field)}
                description={field.description}
                fieldPath={path}
                error={error}
            >
                <FieldGroup className="min-w-0">
                    {Object.entries(field.fields).map(([key, child]) => (
                        <SchemaFieldRenderer
                            key={key}
                            field={child}
                            value={objectValue[key]}
                            onChange={(nextValue) =>
                                onChange({ ...objectValue, [key]: nextValue })
                            }
                            path={objectPath + '.' + key}
                            errors={errors}
                        />
                    ))}
                </FieldGroup>
            </SectionFieldSet>
        );
    }

    if (field.kind === 'oneOf') {
        return (
            <OneOfField
                field={field}
                value={value}
                onChange={onChange}
                path={path}
                errors={errors}
            />
        );
    }

    if (field.kind === 'array_object') {
        return (
            <ArrayObjectField
                field={field}
                value={value}
                onChange={onChange}
                path={path}
                errors={errors}
            />
        );
    }

    if (field.kind === 'array_table') {
        return (
            <ArrayTableField
                field={field}
                value={value}
                onChange={onChange}
                path={path}
                errors={errors}
            />
        );
    }

    if (isComplexInput(field)) {
        return (
            <DataInputField
                field={field}
                value={value}
                onChange={onChange}
                path={path}
                errors={errors}
            />
        );
    }

    const error = fieldError(errors, path);
    const errorId = errorIdForPath(path);

    if (field.kind === 'enum') {
        return (
            <Field className="min-w-0" data-invalid={error ? true : undefined}>
                <FieldLabel>{fieldDisplayLabel(field)}</FieldLabel>
                {field.description ? (
                    <FieldDescription className="break-words">
                        {field.description}
                    </FieldDescription>
                ) : null}
                <Select
                    value={String(value ?? '')}
                    onValueChange={(selected) =>
                        onChange(enumValueFromString(field, selected))
                    }
                >
                    <SelectTrigger
                        className="w-full min-w-0"
                        data-field-path={path}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {field.options?.map((option) => (
                                <SelectItem
                                    key={String(option)}
                                    value={String(option)}
                                >
                                    {optionDisplayLabel(option)}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <InputError id={errorId} message={error} />
            </Field>
        );
    }

    return (
        <Field className="min-w-0" data-invalid={error ? true : undefined}>
            <FieldLabel>{fieldDisplayLabel(field)}</FieldLabel>
            {field.description ? (
                <FieldDescription className="break-words">
                    {field.description}
                </FieldDescription>
            ) : null}
            <Input
                className="min-w-0"
                data-field-path={path}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                type={
                    field.type === 'number' || field.type === 'integer'
                        ? 'number'
                        : 'text'
                }
                value={String(value ?? '')}
                required={field.required === true || Boolean(field.minOccurs)}
                min={field.minimum ?? undefined}
                max={field.maximum ?? undefined}
                data-exclusive-minimum={field.exclusiveMinimum ?? undefined}
                data-exclusive-maximum={field.exclusiveMaximum ?? undefined}
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
            <InputError id={errorId} message={error} />
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
