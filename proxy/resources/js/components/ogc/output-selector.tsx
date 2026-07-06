import { Checkbox } from '@/components/ui/checkbox';
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import {
    defaultOutputTransmissionMode,
    outputComponents,
} from '@/lib/ogc-outputs';
import type { OgcNormalizedOutput } from '@/types';

export default function OutputSelector({
    outputs,
    value,
    onChange,
}: {
    outputs: Record<string, OgcNormalizedOutput>;
    value: Record<string, { transmissionMode: string }>;
    onChange: (value: Record<string, { transmissionMode: string }>) => void;
}) {
    const { t } = useTranslation();

    function toggle(
        outputId: string,
        output: OgcNormalizedOutput,
        checked: boolean,
    ) {
        const next = { ...value };

        if (checked) {
            next[outputId] = {
                transmissionMode:
                    next[outputId]?.transmissionMode ??
                    defaultOutputTransmissionMode(output),
            };
        } else {
            delete next[outputId];
        }

        onChange(next);
    }

    function setTransmissionMode(outputId: string, transmissionMode: string) {
        onChange({
            ...value,
            [outputId]: { transmissionMode },
        });
    }

    return (
        <FieldGroup className="min-w-0">
            {Object.entries(outputs).map(([outputId, output]) => {
                const components = outputComponents(output);

                return (
                    <Field
                        key={outputId}
                        orientation="responsive"
                        className="min-w-0 rounded-md border p-3"
                    >
                        <div className="flex min-w-0 items-start gap-3">
                            <Checkbox
                                id={`output-${outputId}`}
                                checked={Boolean(value[outputId])}
                                onCheckedChange={(checked) =>
                                    toggle(outputId, output, checked === true)
                                }
                            />
                            <FieldContent className="min-w-0">
                                <FieldLabel htmlFor={`output-${outputId}`}>
                                    {output.title}
                                </FieldLabel>
                                <FieldDescription className="break-words">
                                    {output.mediaType}
                                </FieldDescription>

                                {components.length > 0 ? (
                                    <div className="mt-2 flex min-w-0 flex-col gap-1">
                                        {components.map(
                                            ({ componentId, component }) => (
                                                <div
                                                    key={componentId}
                                                    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                                                >
                                                    <span className="font-medium text-foreground">
                                                        {component.name ??
                                                            componentId}
                                                    </span>
                                                    {component.mediaType ? (
                                                        <span className="break-all">
                                                            {
                                                                component.mediaType
                                                            }
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : null}
                            </FieldContent>
                        </div>

                        {value[outputId] ? (
                            <Select
                                value={value[outputId].transmissionMode}
                                onValueChange={(mode) =>
                                    setTransmissionMode(outputId, mode)
                                }
                            >
                                <SelectTrigger className="w-full min-w-0 md:w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="value">
                                            {t('ogc.transmissionValue')}
                                        </SelectItem>
                                        <SelectItem value="reference">
                                            {t('ogc.transmissionReference')}
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        ) : null}
                    </Field>
                );
            })}
        </FieldGroup>
    );
}
