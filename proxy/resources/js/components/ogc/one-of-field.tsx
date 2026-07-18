import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
} from '@/components/ogc/field-validation-feedback';
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
import {
    errorIdForPath,
    fieldError,
    oneOfStructuralError,
} from '@/lib/ogc-form-errors';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import { defaultObjectValue, isOneOfValue } from '@/lib/ogc-form-values';
import { cn } from '@/lib/utils';
import type { OgcNormalizedField } from '@/types';

export default function OneOfField({
    field,
    value,
    onChange,
    path,
    validation,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    validation: OgcFieldValidationController;
}) {
    const errors = validation.errors;
    const variants = field.variants ?? [];
    const current = isOneOfValue(value)
        ? value
        : { variant: variants[0]?.id ?? '0', value: {} };
    const selected =
        variants.find((variant) => variant.id === current.variant) ??
        variants[0];
    const structuralError = oneOfStructuralError(errors, path);
    const structuralState = validation.stateFor(path, structuralError);
    const variantPath = path + '.variant';
    const variantError = fieldError(errors, variantPath);
    const variantErrorId = errorIdForPath(variantPath);
    const variantState = validation.stateFor(variantPath, variantError);

    if (!selected) {
        return null;
    }

    return (
        <SectionFieldSet
            label={fieldDisplayLabel(field)}
            description={field.description}
            className="overflow-hidden"
            fieldPath={path}
            error={structuralError}
            validationState={structuralState}
        >
            <OgcValidationControl
                state={variantState}
                validLabel={validation.validLabel}
                hasBuiltInEndIcon
            >
                <Select
                    value={current.variant}
                    onValueChange={(variant) => {
                        const selectedVariant = variants.find(
                            (item) => item.id === variant,
                        );

                        validation.resetPathPrefix(path + '.value');
                        validation.fieldChanged(variantPath);
                        onChange({
                            variant,
                            value: selectedVariant
                                ? defaultObjectValue(selectedVariant.fields)
                                : {},
                        });
                    }}
                >
                    <SelectTrigger
                        className={cn(
                            'w-full max-w-full min-w-0',
                            ogcValidationControlClassName(variantState, true),
                        )}
                        data-field-path={variantPath}
                        data-validation-state={ogcValidationDataState(
                            variantState,
                        )}
                        aria-invalid={
                            variantState === 'invalid' ? true : undefined
                        }
                        aria-describedby={
                            variantError ? variantErrorId : undefined
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
            </OgcValidationControl>
            <OgcFieldError id={variantErrorId} message={variantError} />
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
                        validation={validation}
                    />
                ))}
            </FieldGroup>
        </SectionFieldSet>
    );
}
