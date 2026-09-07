import SectionFieldSet from '@/components/ogc/section-field-set';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel, optionDisplayLabel } from '@/lib/ogc-fields';
import type { OgcNormalizedField } from '@/types';

export default function ReadOnlyFieldValue({
    field,
    value,
    path,
}: {
    field: OgcNormalizedField;
    value: unknown;
    path: string;
}) {
    const { t } = useTranslation();
    const id = `review-${encodeURIComponent(path)}`;

    if (value !== null && typeof value === 'object') {
        return (
            <SectionFieldSet
                label={fieldDisplayLabel(field)}
                description={field.description}
            >
                <FieldGroup>
                    {Object.entries(value).map(([name, child]) => (
                        <ReadOnlyFieldValue
                            key={name}
                            field={{
                                name,
                                title: Array.isArray(value)
                                    ? t('ogc.arrayTableRow', {
                                          row: Number(name) + 1,
                                      })
                                    : name.replaceAll('_', ' '),
                                kind: 'scalar',
                            }}
                            value={child}
                            path={path + '.' + name}
                        />
                    ))}
                    {Object.keys(value).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('jobs.inputEmpty')}
                        </p>
                    ) : null}
                </FieldGroup>
            </SectionFieldSet>
        );
    }

    const text =
        value === undefined || value === null
            ? t('jobs.inputNotProvided')
            : typeof value === 'boolean'
              ? optionDisplayLabel(value)
              : String(value);

    return (
        <Field className="min-w-0">
            <FieldLabel htmlFor={id}>{fieldDisplayLabel(field)}</FieldLabel>
            {field.description ? (
                <FieldDescription>{field.description}</FieldDescription>
            ) : null}
            {text.includes('\n') || text.length > 120 ? (
                <Textarea
                    id={id}
                    value={text}
                    readOnly
                    className="max-h-96 min-w-0 overflow-auto"
                />
            ) : (
                <Input id={id} value={text} readOnly />
            )}
        </Field>
    );
}
