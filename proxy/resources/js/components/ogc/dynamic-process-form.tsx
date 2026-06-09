import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OgcFormSchema } from '@/types';

export default function DynamicProcessForm({ schema }: { schema: OgcFormSchema }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Inputs</CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(schema.fields, null, 2)}</pre>
            </CardContent>
        </Card>
    );
}
