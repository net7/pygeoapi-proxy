import ArrayObjectField from '@/components/ogc/array-object-field';
import ArrayTableField from '@/components/ogc/array-table-field';
import DataInputField from '@/components/ogc/data-input-field';
import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
    ogcValidationFieldClassName,
} from '@/components/ogc/field-validation-feedback';
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
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import { cn } from '@/lib/utils';
import type { OgcNormalizedField } from '@/types';

export default function SchemaFieldRenderer({
    field,
    value,
    onChange,
    path,
    validation,
    topLevel = false,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    validation: OgcFieldValidationController;
    topLevel?: boolean;
}) {
    const errors = validation.errors;

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
                validationState={validation.stateFor(path, error)}
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
                            validation={validation}
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
                validation={validation}
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
                validation={validation}
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
                validation={validation}
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
                validation={validation}
            />
        );
    }

    const error = fieldError(errors, path);
    const errorId = errorIdForPath(path);
    const state = validation.stateFor(path, error);

    if (field.kind === 'enum') {
        return (
            <Field
                className={cn('min-w-0', ogcValidationFieldClassName(state))}
                data-invalid={state === 'invalid' ? true : undefined}
            >
                <FieldLabel>{fieldDisplayLabel(field)}</FieldLabel>
                {field.description ? (
                    <FieldDescription className="break-words">
                        {field.description}
                    </FieldDescription>
                ) : null}
                <OgcValidationControl
                    state={state}
                    validLabel={validation.validLabel}
                    hasBuiltInEndIcon
                >
                    <Select
                        value={String(value ?? '')}
                        onValueChange={(selected) => {
                            validation.fieldChanged(path);
                            onChange(enumValueFromString(field, selected));
                        }}
                    >
                        <SelectTrigger
                            className={cn(
                                'w-full min-w-0',
                                ogcValidationControlClassName(state, true),
                            )}
                            data-field-path={path}
                            data-validation-state={ogcValidationDataState(
                                state,
                            )}
                            aria-invalid={
                                state === 'invalid' ? true : undefined
                            }
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
                </OgcValidationControl>
                <OgcFieldError id={errorId} message={error} />
            </Field>
        );
    }

    return (
        <Field
            className={cn('min-w-0', ogcValidationFieldClassName(state))}
            data-invalid={state === 'invalid' ? true : undefined}
        >
            <FieldLabel>{fieldDisplayLabel(field)}</FieldLabel>
            {field.description ? (
                <FieldDescription className="break-words">
                    {field.description}
                </FieldDescription>
            ) : null}
            <OgcValidationControl
                state={state}
                validLabel={validation.validLabel}
            >
                <Input
                    className={cn(
                        'min-w-0',
                        ogcValidationControlClassName(state),
                    )}
                    data-field-path={path}
                    data-validation-state={ogcValidationDataState(state)}
                    aria-invalid={state === 'invalid' ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    type={
                        field.type === 'number' || field.type === 'integer'
                            ? 'number'
                            : 'text'
                    }
                    value={String(value ?? '')}
                    required={
                        field.required === true || Boolean(field.minOccurs)
                    }
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
                            field.type === 'number' || field.type === 'integer'
                                ? Number(raw)
                                : raw,
                        );
                    }}
                />
            </OgcValidationControl>
            <OgcFieldError id={errorId} message={error} />
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
