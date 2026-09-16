import { ContentTransition } from '@/components/content-transition';
import {
    OgcFieldError,
    OgcValidationControl,
    ogcValidationControlClassName,
    ogcValidationDataState,
} from '@/components/ogc/field-validation-feedback';
import ReadOnlyFieldValue from '@/components/ogc/read-only-field-value';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { runUiTransition } from '@/lib/motion';
import { fieldDisplayLabel, variantDisplayLabel } from '@/lib/ogc-fields';
import {
    errorIdForPath,
    fieldError,
    oneOfStructuralError,
} from '@/lib/ogc-form-errors';
import { updateVariantProperty } from '@/lib/ogc-form-updates';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import {
    defaultObjectValue,
    fieldsWithSubmittedValues,
    isOneOfValue,
} from '@/lib/ogc-form-values';
import { cn } from '@/lib/utils';
import type { OgcNormalizedField } from '@/types';

export default function OneOfField({
    field,
    value,
    onChange,
    path,
    validation,
    readOnly = false,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
    path: string;
    validation: OgcFieldValidationController;
    readOnly?: boolean;
}) {
    const { language } = useTranslation();
    const errors = validation.errors;
    const variants = (field.variants ?? []).map((variant) => ({
        ...variant,
        label: variantDisplayLabel(variant.label, language),
    }));
    const current = isOneOfValue(value)
        ? value
        : { variant: variants[0]?.id ?? '0', value: {} };
    const selected =
        variants.find((variant) => variant.id === current.variant) ??
        (readOnly ? undefined : variants[0]);
    const structuralError = oneOfStructuralError(errors, path);
    const structuralState = validation.stateFor(path, structuralError);
    const variantPath = path + '.variant';
    const variantError = fieldError(errors, variantPath);
    const variantErrorId = errorIdForPath(variantPath);
    const variantState = validation.stateFor(variantPath, variantError);
    const sectionState =
        structuralState === 'invalid' || variantState === 'invalid'
            ? 'invalid'
            : structuralState === 'corrected' || variantState === 'corrected'
              ? 'corrected'
              : 'neutral';

    if (!selected) {
        return readOnly ? (
            <ReadOnlyFieldValue
                field={field}
                value={current.value}
                path={path}
            />
        ) : null;
    }

    return (
        <ContentTransition default="none" update="content-change">
            <SectionFieldSet
                label={fieldDisplayLabel(field)}
                supportReference={field.name}
                description={field.description}
                className="overflow-hidden"
                fieldPath={path}
                error={structuralError}
                validationState={sectionState}
            >
                <OgcValidationControl
                    state={variantState}
                    validLabel={validation.validLabel}
                    hasBuiltInEndIcon
                >
                    {readOnly ? (
                        <Input
                            value={selected.label}
                            readOnly
                            aria-label={fieldDisplayLabel(field)}
                        />
                    ) : (
                        <Select
                            value={current.variant}
                            onValueChange={(variant) =>
                                runUiTransition(() => {
                                    const selectedVariant = variants.find(
                                        (item) => item.id === variant,
                                    );

                                    validation.resetPathPrefix(path + '.value');
                                    validation.fieldChanged(variantPath);
                                    onChange({
                                        variant,
                                        value: selectedVariant
                                            ? defaultObjectValue(
                                                  selectedVariant.fields,
                                              )
                                            : {},
                                    });
                                })
                            }
                        >
                            <SelectTrigger
                                className={cn(
                                    'w-full max-w-full min-w-0',
                                    ogcValidationControlClassName(
                                        variantState,
                                        true,
                                    ),
                                )}
                                data-field-path={variantPath}
                                data-validation-state={ogcValidationDataState(
                                    variantState,
                                )}
                                aria-invalid={
                                    variantState === 'invalid'
                                        ? true
                                        : undefined
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
                                        <SelectItem
                                            key={variant.id}
                                            value={variant.id}
                                        >
                                            {variant.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    )}
                </OgcValidationControl>
                <OgcFieldError id={variantErrorId} message={variantError} />
                {selected.description ? (
                    <FieldDescription className="break-words">
                        {selected.description}
                    </FieldDescription>
                ) : null}

                <FieldGroup key={selected.id} className="min-w-0">
                    {Object.entries(
                        readOnly
                            ? fieldsWithSubmittedValues(
                                  selected.fields,
                                  current.value,
                              )
                            : selected.fields,
                    ).map(([key, child]) => (
                        <SchemaFieldRenderer
                            key={key}
                            field={child}
                            value={current.value[key]}
                            onChange={(nextValue) =>
                                onChange((latest: unknown) =>
                                    updateVariantProperty(
                                        latest,
                                        current.variant,
                                        key,
                                        nextValue,
                                    ),
                                )
                            }
                            path={path + '.value.' + key}
                            validation={validation}
                            readOnly={readOnly}
                        />
                    ))}
                </FieldGroup>
            </SectionFieldSet>
        </ContentTransition>
    );
}
