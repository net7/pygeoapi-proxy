import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import {
    FieldDescription,
    FieldGroup,
    FieldLegend,
    FieldSet,
} from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
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
        <FieldSet className="max-w-full min-w-0 overflow-hidden">
            <FieldLegend>{fieldDisplayLabel(field)}</FieldLegend>
            {field.description ? (
                <FieldDescription className="break-words">
                    {field.description}
                </FieldDescription>
            ) : null}
            {selected.description ? (
                <FieldDescription className="break-words">
                    {selected.description}
                </FieldDescription>
            ) : null}
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
                                {variant.id}: {variant.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>

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

function defaultObjectValue(
    fields: Record<string, OgcNormalizedField>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, defaultFieldValue(field)] as const)
            .filter(([, value]) => value !== undefined),
    );
}

function defaultFieldValue(field: OgcNormalizedField): unknown {
    if (field.kind === 'enum' && field.options?.length === 1) {
        return field.options[0];
    }

    if (field.kind === 'object' && field.fields) {
        const value = defaultObjectValue(field.fields);

        return Object.keys(value).length > 0 ? value : undefined;
    }

    if (field.kind === 'array_object' && field.minItems && field.minItems > 0) {
        return Array.from({ length: field.minItems }, () =>
            defaultObjectValue(field.fields ?? {}),
        );
    }

    return undefined;
}
