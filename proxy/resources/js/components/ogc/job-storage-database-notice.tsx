import { DatabaseIcon } from 'lucide-react';

import { useTranslation } from '@/hooks/use-translation';
import type { JobStorage } from '@/types';

export function JobStorageDatabaseNotice({ storage }: { storage: JobStorage }) {
    const { t } = useTranslation();

    if (storage.databaseResultCount === 0) {
        return null;
    }

    return (
        <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
            <DatabaseIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
            />
            <p>
                {t(
                    storage.fileCount === 0
                        ? 'jobs.storage.databaseOnly'
                        : 'jobs.storage.databaseResults',
                )}
            </p>
        </div>
    );
}
