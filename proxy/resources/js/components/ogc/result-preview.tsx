import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProcessExecutionResult } from '@/types';

export default function ResultPreview({
    result,
}: {
    executionId: number;
    result: ProcessExecutionResult;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{result.title ?? result.outputId}</CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(result.preview, null, 2)}
                </pre>
            </CardContent>
        </Card>
    );
}
