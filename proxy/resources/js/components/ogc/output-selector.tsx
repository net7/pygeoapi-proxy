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
    function toggle(outputId: string, checked: boolean) {
        const next = { ...value };

        if (checked) {
            next[outputId] = {
                transmissionMode: next[outputId]?.transmissionMode ?? 'value',
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
            {Object.entries(outputs).map(([outputId, output]) => (
                <Field
                    key={outputId}
                    orientation="horizontal"
                    className="min-w-0 items-center justify-between rounded-md border p-3"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <Checkbox
                            id={`output-${outputId}`}
                            checked={Boolean(value[outputId])}
                            onCheckedChange={(checked) =>
                                toggle(outputId, checked === true)
                            }
                        />
                        <FieldContent className="min-w-0">
                            <FieldLabel htmlFor={`output-${outputId}`}>
                                {output.title}
                            </FieldLabel>
                            <FieldDescription className="break-words">
                                {output.mediaType}
                            </FieldDescription>
                        </FieldContent>
                    </div>

                    {value[outputId] ? (
                        <Select
                            value={value[outputId].transmissionMode}
                            onValueChange={(mode) =>
                                setTransmissionMode(outputId, mode)
                            }
                        >
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="value">Value</SelectItem>
                                    <SelectItem value="reference">
                                        Reference
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    ) : null}
                </Field>
            ))}
        </FieldGroup>
    );
}
