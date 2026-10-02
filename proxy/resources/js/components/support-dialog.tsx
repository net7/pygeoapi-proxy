import { LifeBuoyIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
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
    const contentRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
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
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!processing) {
                    setOpen(nextOpen);
                }
            }}
        >
            <DialogTrigger asChild>{button}</DialogTrigger>
            <DialogContent
                ref={contentRef}
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
                closeButtonDisabled={processing}
                closeButtonRef={closeButtonRef}
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
                onPointerDownOutside={() => {
                    const closeButton = closeButtonRef.current;

                    if (
                        !closeButton ||
                        processing ||
                        window.matchMedia('(prefers-reduced-motion: reduce)')
                            .matches
                    ) {
                        return;
                    }

                    closeButton
                        .getAnimations()
                        .forEach((animation) => animation.cancel());
                    closeButton.animate(
                        [
                            { transform: 'scale(1)' },
                            { transform: 'scale(1.2)' },
                            { transform: 'scale(1)' },
                        ],
                        { duration: 280, easing: 'ease-in-out' },
                    );
                }}
                onOpenAutoFocus={(event) => {
                    if (initialEmail.trim()) {
                        const subject =
                            contentRef.current?.querySelector<HTMLInputElement>(
                                '#support-subject',
                            );

                        if (subject) {
                            event.preventDefault();
                            subject.focus();
                        }
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{t('support.title')}</DialogTitle>
                    <DialogDescription>{t('support.intro')}</DialogDescription>
                </DialogHeader>
                {support.available ? (
                    <SupportForm
                        initialEmail={initialEmail}
                        limits={support}
                        onProcessingChange={setProcessing}
                    />
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
