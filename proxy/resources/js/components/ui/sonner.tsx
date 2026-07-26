import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/hooks/use-translation';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ toastOptions, ...props }: ToasterProps) {
    const { appearance } = useAppearance();
    const { t } = useTranslation();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position="bottom-right"
            richColors
            closeButton
            containerAriaLabel={t('toast.notifications')}
            icons={{
                success: null,
                info: null,
                warning: null,
                error: null,
                loading: null,
            }}
            toastOptions={{
                closeButtonAriaLabel: t('toast.close'),
                ...toastOptions,
                classNames: {
                    ...toastOptions?.classNames,
                    icon: 'hidden!',
                },
            }}
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--muted-foreground)',
                    '--success-bg':
                        'color-mix(in oklab, var(--success) 10%, var(--popover))',
                    '--success-text': 'var(--success-emphasis)',
                    '--success-border': 'var(--success-emphasis)',
                    '--info-bg':
                        'color-mix(in oklab, var(--info) 10%, var(--popover))',
                    '--info-text': 'var(--info-emphasis)',
                    '--info-border': 'var(--info-emphasis)',
                    '--warning-bg':
                        'color-mix(in oklab, var(--warning) 10%, var(--popover))',
                    '--warning-text': 'var(--warning-emphasis)',
                    '--warning-border': 'var(--warning-emphasis)',
                    '--error-bg':
                        'color-mix(in oklab, var(--destructive) 10%, var(--popover))',
                    '--error-text': 'var(--destructive-emphasis)',
                    '--error-border': 'var(--destructive-emphasis)',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
