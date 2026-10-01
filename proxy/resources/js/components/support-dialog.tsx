import { LifeBuoyIcon } from 'lucide-react';
import { useId } from 'react';
import { SupportForm } from '@/components/support-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import type { SupportConfiguration } from '@/types/support';

export function SupportDialog({
    initialEmail,
    support,
}: {
    initialEmail: string;
    support: SupportConfiguration;
}) {
    const { t } = useTranslation();
    const explanationId = useId();
    const button = (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={support.isTechnicalContact}
            className="shrink-0"
        >
            <LifeBuoyIcon aria-hidden="true" data-icon="inline-start" />
            {t('support.title')}
        </Button>
    );

    if (support.isTechnicalContact) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <span
                        role="button"
                        tabIndex={0}
                        aria-label={t('support.disabledHelp')}
                        className="inline-flex shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.currentTarget.click();
                            }
                        }}
                    >
                        {button}
                    </span>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    aria-labelledby={explanationId + '-title'}
                    aria-describedby={explanationId + '-description'}
                >
                    <PopoverHeader>
                        <PopoverTitle id={explanationId + '-title'}>
                            {t('support.disabledHelp')}
                        </PopoverTitle>
                        <PopoverDescription id={explanationId + '-description'}>
                            {t('support.technicalContactDisabled')}
                        </PopoverDescription>
                    </PopoverHeader>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>{button}</DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('support.title')}</DialogTitle>
                    <DialogDescription>{t('support.intro')}</DialogDescription>
                </DialogHeader>
                {support.available ? (
                    <SupportForm initialEmail={initialEmail} limits={support} />
                ) : (
                    <Alert>
                        <AlertDescription>
                            {t('support.unavailable')}
                        </AlertDescription>
                    </Alert>
                )}
            </DialogContent>
        </Dialog>
    );
}
