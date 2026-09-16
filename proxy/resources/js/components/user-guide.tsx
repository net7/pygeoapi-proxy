import { useHttp } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ChartNoAxesCombined,
    CircleHelp,
    Info,
    KeyRound,
    ListChecks,
    ShieldCheck,
    SlidersHorizontal,
    UsersRound,
    Workflow,
    Wrench,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';
import { complete } from '@/routes/first-access';
import type { User } from '@/types';

const userChapters = [
    { key: 'choose', icon: Workflow, adminOnly: false },
    { key: 'configure', icon: SlidersHorizontal, adminOnly: false },
    { key: 'monitor', icon: ListChecks, adminOnly: false },
    { key: 'results', icon: ChartNoAxesCombined, adminOnly: false },
] as const;

const adminChapters = [
    ...userChapters,
    { key: 'adminUsers', icon: UsersRound, adminOnly: true },
    { key: 'adminSignIn', icon: KeyRound, adminOnly: true },
    { key: 'adminAccounts', icon: ShieldCheck, adminOnly: true },
    { key: 'adminJobs', icon: ListChecks, adminOnly: true },
    { key: 'adminDiagnostics', icon: Wrench, adminOnly: true },
] as const;

const instructions = ['first', 'second', 'third'] as const;

export function UserGuide({
    user,
}: {
    user: Pick<User, 'id' | 'name' | 'is_admin' | 'first_access_completed_at'>;
}) {
    const { t } = useTranslation();
    const chapters = user.is_admin ? adminChapters : userChapters;
    const [open, setOpen] = useState(user.first_access_completed_at === null);
    const [activeChapter, setActiveChapter] = useState(0);
    const { patch, processing, wasSuccessful } = useHttp({});
    const titleId = useId();
    const chapterTitle = useRef<HTMLHeadingElement>(null);
    const chapter = chapters[activeChapter];
    const ChapterIcon = chapter.icon;
    const hasCompletedFirstAccess =
        user.first_access_completed_at !== null || wasSuccessful;

    function changeOpen(nextOpen: boolean) {
        setOpen(nextOpen);

        if (nextOpen) {
            setActiveChapter(0);
        } else if (!hasCompletedFirstAccess && !processing) {
            void patch(complete.url()).catch(() => {
                toast.error(t('userGuide.saveError'));
            });
        }
    }

    function selectChapter(index: number) {
        setActiveChapter(index);
        requestAnimationFrame(() => {
            chapterTitle.current?.focus();
            chapterTitle.current?.scrollIntoView({ block: 'nearest' });
        });
    }

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    aria-label={t('userGuide.open')}
                >
                    <CircleHelp data-icon="inline-start" aria-hidden="true" />
                    {t('userGuide.help')}
                </Button>
            </DialogTrigger>
            <DialogContent
                className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none md:h-[90dvh] md:w-[92vw] xl:max-w-7xl"
                onPointerDownOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left md:px-8 md:py-6 md:pr-14">
                    <DialogTitle className="text-xl leading-tight font-normal break-words sm:text-2xl">
                        {t('userGuide.greeting')} <strong>{user.name}</strong>!
                    </DialogTitle>
                    <DialogDescription className="max-w-2xl leading-relaxed">
                        {t(
                            user.is_admin
                                ? 'userGuide.adminDescription'
                                : 'userGuide.description',
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <nav
                        aria-label={t('userGuide.chapters')}
                        className="flex flex-col gap-6 border-b bg-muted/50 p-4 md:overflow-y-auto md:border-r md:border-b-0 md:p-6"
                    >
                        <ol className="grid grid-cols-2 gap-2 md:flex md:flex-col">
                            {chapters.map((item, index) => (
                                <li key={item.key} className="min-w-0">
                                    <Button
                                        type="button"
                                        variant={
                                            activeChapter === index
                                                ? 'secondary'
                                                : 'ghost'
                                        }
                                        className="h-full min-h-11 w-full justify-start gap-3 px-3 py-3 text-left whitespace-normal"
                                        aria-current={
                                            activeChapter === index
                                                ? 'step'
                                                : undefined
                                        }
                                        onClick={() => selectChapter(index)}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="shrink-0 tabular-nums"
                                        >
                                            {index + 1}.
                                        </span>
                                        <span className="flex min-w-0 flex-col items-start gap-1.5">
                                            <span>
                                                {t(
                                                    `userGuide.${item.key}.label`,
                                                )}
                                            </span>
                                            {item.adminOnly ? (
                                                <Badge
                                                    variant="outline"
                                                    className="max-w-full whitespace-normal"
                                                >
                                                    {t('userGuide.adminOnly')}
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </Button>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-auto hidden text-sm leading-relaxed text-muted-foreground md:block">
                            {t('userGuide.reopen')}
                        </p>
                    </nav>

                    <section
                        key={chapter.key}
                        aria-labelledby={titleId}
                        className="min-w-0 overscroll-contain p-5 md:overflow-y-auto md:p-8 lg:p-10"
                    >
                        <div className="mx-auto flex max-w-3xl flex-col gap-7">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <ChapterIcon
                                        className="size-9 text-primary"
                                        aria-hidden="true"
                                    />
                                    {chapter.adminOnly ? (
                                        <Badge variant="secondary">
                                            {t('userGuide.adminOnly')}
                                        </Badge>
                                    ) : null}
                                </div>
                                <h2
                                    ref={chapterTitle}
                                    id={titleId}
                                    tabIndex={-1}
                                    className="text-2xl leading-tight font-semibold tracking-tight outline-none sm:text-3xl"
                                >
                                    {t(`userGuide.${chapter.key}.title`)}
                                </h2>
                                <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
                                    {t(`userGuide.${chapter.key}.description`)}
                                </p>
                            </div>

                            <dl className="flex flex-col gap-5">
                                {instructions.map((instruction) => (
                                    <div
                                        key={instruction}
                                        className="flex flex-col gap-1.5"
                                    >
                                        <dt className="font-semibold">
                                            {t(
                                                `userGuide.${chapter.key}.${instruction}Title`,
                                            )}
                                        </dt>
                                        <dd className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                                            {t(
                                                `userGuide.${chapter.key}.${instruction}Body`,
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>

                            <Alert>
                                <Info aria-hidden="true" />
                                <AlertTitle>{t('userGuide.tip')}</AlertTitle>
                                <AlertDescription className="leading-relaxed">
                                    {t(`userGuide.${chapter.key}.tip`)}
                                </AlertDescription>
                            </Alert>
                        </div>
                    </section>
                </div>

                <DialogFooter className="shrink-0 flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
                    <div className="flex items-center justify-between gap-3 sm:justify-start">
                        <span
                            className="text-sm text-muted-foreground"
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            {t('userGuide.step', {
                                current: activeChapter + 1,
                                total: chapters.length,
                            })}
                        </span>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost" size="sm">
                                {t('userGuide.close')}
                            </Button>
                        </DialogClose>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={activeChapter === 0}
                            onClick={() => selectChapter(activeChapter - 1)}
                        >
                            <ArrowLeft
                                data-icon="inline-start"
                                aria-hidden="true"
                            />
                            {t('userGuide.previous')}
                        </Button>
                        {activeChapter === chapters.length - 1 ? (
                            <DialogClose asChild>
                                <Button type="button">
                                    {t('userGuide.finish')}
                                </Button>
                            </DialogClose>
                        ) : (
                            <Button
                                type="button"
                                onClick={() => selectChapter(activeChapter + 1)}
                            >
                                {t('userGuide.next')}
                                <ArrowRight
                                    data-icon="inline-end"
                                    aria-hidden="true"
                                />
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
