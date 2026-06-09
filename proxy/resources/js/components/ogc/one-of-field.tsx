import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { OgcNormalizedField } from '@/types';

type OneOfValue = {
    variant: string;
    value: Record<string, unknown>;
};

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
        <FieldSet>
            <FieldLegend>{field.title}</FieldLegend>
            <Select
                value={current.variant}
                onValueChange={(variant) => onChange({ variant, value: {} })}
            >
                <SelectTrigger>
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

            <FieldGroup>
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
        </FieldSet>
    );
}

function isOneOfValue(value: unknown): value is OneOfValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        'variant' in value &&
        'value' in value
    );
}
