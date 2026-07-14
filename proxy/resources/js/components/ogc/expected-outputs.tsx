import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import type { OgcNormalizedOutput } from '@/types';

export default function ExpectedOutputs({
    outputs,
}: {
    outputs: Record<string, OgcNormalizedOutput>;
}) {
    const { t } = useTranslation();

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('ogc.expectedOutputs')}</CardTitle>
                <CardDescription>
                    {t('ogc.expectedOutputsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
                <ul className="flex min-w-0 list-disc flex-col gap-3 pl-5">
                    {Object.entries(outputs).map(([outputId, output]) => (
                        <li key={outputId} className="min-w-0">
                            <h3 className="text-sm font-medium break-words">
                                {output.title}
                            </h3>
                            {output.description ? (
                                <p className="mt-1 text-sm break-words text-muted-foreground">
                                    {output.description}
                                </p>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
