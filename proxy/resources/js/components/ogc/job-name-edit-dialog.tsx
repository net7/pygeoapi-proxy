import { useForm } from '@inertiajs/react';
import { PencilIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { update } from '@/routes/jobs/name';
import type { ProcessExecutionDetail } from '@/types';

type NameForm = {
    name: string;
};

export function JobNameEditDialog({
    execution,
}: {
    execution: ProcessExecutionDetail;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data, setData, patch, processing, reset, errors } =
        useForm<NameForm>({
            name: execution.name ?? '',
        });

    useEffect(() => {
        if (open) {
            setData('name', execution.name ?? '');
        }
    }, [execution.name, open, setData]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        patch(update.url(execution.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);

                if (!nextOpen) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t('jobs.editProcessName')}
                    title={t('jobs.editProcessName')}
                >
                    <PencilIcon data-icon="icon" />
                    <span className="sr-only">{t('jobs.editProcessName')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <form className="flex flex-col gap-4" onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{t('jobs.editProcessName')}</DialogTitle>
                        <DialogDescription>
                            {t('jobs.editProcessNameDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex min-w-0 flex-col gap-2">
                        <Label htmlFor="job-process-name">
                            {t('jobs.processName')}
                        </Label>
                        <Input
                            id="job-process-name"
                            value={data.name}
                            onChange={(event) =>
                                setData('name', event.target.value)
                            }
                            placeholder={execution.displayName}
                            maxLength={255}
                            aria-invalid={Boolean(errors.name)}
                        />
                        <InputError message={errors.name} />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? (
                                <Spinner data-icon="inline-start" />
                            ) : null}
                            {t('jobs.saveProcessName')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
