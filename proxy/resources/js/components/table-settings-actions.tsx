import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

export function TableSettingsActions({
    error,
    loadError,
    retrySettings,
}: {
    error: unknown;
    loadError: boolean;
    retrySettings: () => void;
}) {
    const { t } = useTranslation();

    return (
        <>
            {error ? (
                <span role="alert" className="text-sm text-destructive">
                    {t(
                        loadError
                            ? 'tables.loadError'
                            : 'tables.settingsSaveError',
                    )}
                </span>
            ) : null}
            {error ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retrySettings}
                >
                    {t('tables.retry')}
                </Button>
            ) : null}
        </>
    );
}

export function TableSettingsReset({
    saving,
    canReset,
    resetSettings,
}: {
    saving: boolean;
    canReset: boolean;
    resetSettings: () => void;
}) {
    const { t } = useTranslation();

    if (!canReset) {
        return null;
    }

    return (
        <button
            type="button"
            disabled={saving}
            onClick={resetSettings}
            className="w-fit cursor-pointer text-xs text-muted-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-50"
        >
            {t('tables.resetSettings')}
        </button>
    );
}
