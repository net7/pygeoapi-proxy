import InputError from '@/components/input-error';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import { errorIdForPath, fieldError } from '@/lib/ogc-form-errors';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
import { defaultObjectValue, isOneOfValue } from '@/lib/ogc-form-values';
import type { OgcNormalizedField } from '@/types';

export default function OneOfField({
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
    const variants = field.variants ?? [];
    const current = isOneOfValue(value)
        ? value
        : { variant: variants[0]?.id ?? '0', value: {} };
    const selected =
        variants.find((variant) => variant.id === current.variant) ??
        variants[0];

    if (!selected) {
        return null;
    }

    return (
        <SectionFieldSet
            label={fieldDisplayLabel(field)}
            description={field.description}
            className="overflow-hidden"
            fieldPath={path}
            error={fieldError(errors, path)}
        >
            <Select
                value={current.variant}
                onValueChange={(variant) => {
                    const selectedVariant = variants.find(
                        (item) => item.id === variant,
                    );

                    onChange({
                        variant,
                        value: selectedVariant
                            ? defaultObjectValue(selectedVariant.fields)
                            : {},
                    });
                }}
            >
                <SelectTrigger
                    className="w-full max-w-full min-w-0"
                    data-field-path={path + '.variant'}
                    aria-invalid={
                        fieldError(errors, path + '.variant') ? true : undefined
                    }
                    aria-describedby={
                        fieldError(errors, path + '.variant')
                            ? errorIdForPath(path + '.variant')
                            : undefined
                    }
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {variants.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                                {variant.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <InputError
                id={errorIdForPath(path + '.variant')}
                message={fieldError(errors, path + '.variant')}
            />
            {selected.description ? (
                <FieldDescription className="break-words">
                    {selected.description}
                </FieldDescription>
            ) : null}

            <FieldGroup className="min-w-0">
                {Object.entries(selected.fields).map(([key, child]) => (
                    <SchemaFieldRenderer
                        key={key}
                        field={child}
                        value={current.value[key]}
                        onChange={(nextValue) =>
                            onChange({
                                variant: current.variant,
                                value: { ...current.value, [key]: nextValue },
                            })
                        }
                        path={path + '.value.' + key}
                        errors={errors}
                    />
                ))}
            </FieldGroup>
        </SectionFieldSet>
    );
}
