import { useForm } from '@inertiajs/react';
import { PencilIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { JobNoteEditor } from '@/components/ogc/job-note-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { update } from '@/routes/jobs/note';
import type { ProcessExecutionDetail, TiptapDocument } from '@/types';

type NoteForm = {
    note: TiptapDocument | null;
};

export function JobNoteCard({
    execution,
}: {
    execution: ProcessExecutionDetail;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data, setData, patch, processing, reset } = useForm<NoteForm>({
        note: execution.note ?? null,
    });

    useEffect(() => {
        if (open) {
            setData('note', execution.note ?? null);
        }
    }, [execution.note, open, setData]);

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
            <Card className="min-w-0 shadow-sm dark:border-border/70 dark:bg-card/95">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <CardTitle>{t('jobs.note')}</CardTitle>
                    </div>
                    <DialogTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-fit"
                        >
                            <PencilIcon data-icon="inline-start" />
                            {t('jobs.editNote')}
                        </Button>
                    </DialogTrigger>
                </CardHeader>
                <CardContent className="min-w-0">
                    {execution.note ? (
                        <JobNoteEditor value={execution.note} readOnly />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {t('jobs.noNote')}
                        </p>
                    )}
                </CardContent>
            </Card>

            <DialogContent
                className="sm:max-w-2xl"
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                <form className="flex flex-col gap-4" onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{t('jobs.editNote')}</DialogTitle>
                        <DialogDescription>
                            {t('jobs.editNoteDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <JobNoteEditor
                        autoFocus
                        value={data.note}
                        onChange={(note) => setData('note', note)}
                    />

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
                            {t('jobs.saveNote')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
