import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { update } from '@/routes/admin/users/technical-contact';
import type { TechnicalContact } from '@/types/support';

export function TechnicalContactDialog({
    candidate,
    currentContact,
    open,
    onOpenChange,
}: {
    candidate: TechnicalContact;
    currentContact: TechnicalContact | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation();
    const form = useForm<Record<string, never>>(update(candidate.id), {});

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (form.processing) {
            return;
        }

        form.submit({
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!form.processing) {
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('technicalContact.appoint')}</DialogTitle>
                    <DialogDescription>
                        {t('technicalContact.confirmCandidate', {
                            name: candidate.name,
                            email: candidate.email,
                        })}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="flex flex-col gap-5">
                    <p className="text-sm text-muted-foreground">
                        {currentContact
                            ? t('technicalContact.replace', {
                                  name: currentContact.name,
                                  email: currentContact.email,
                              })
                            : t('technicalContact.firstAppointment')}
                    </p>
                    {Object.values(form.errors).map((error, index) => (
                        <Alert key={index} variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ))}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={form.processing}
                            >
                                {t('common.cancel')}
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && (
                                <Spinner data-icon="inline-start" />
                            )}
                            {t('technicalContact.confirm')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
