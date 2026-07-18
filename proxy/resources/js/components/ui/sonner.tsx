import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position="bottom-right"
            richColors
            closeButton
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
