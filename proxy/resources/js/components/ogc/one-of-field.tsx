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
    defaultObjectValue,
    isOneOfValue,
} from '@/lib/ogc-form-values';
import type { OgcNormalizedField } from '@/types';

export default function OneOfField({
    field,
    value,
    onChange,
}: {
    field: OgcNormalizedField;
    value: unknown;
    onChange: (value: unknown) => void;
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
                <SelectTrigger className="w-full max-w-full min-w-0">
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
                    />
                ))}
            </FieldGroup>
        </SectionFieldSet>
    );
}
