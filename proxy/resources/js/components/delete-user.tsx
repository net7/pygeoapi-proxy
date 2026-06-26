import { Form } from '@inertiajs/react';
import { MailCheckIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useRef } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';

type Props = {
    usesPasswordConfirmation: boolean;
    sensitiveConfirmationUrl: string | null;
};

export default function DeleteUser({
    usesPasswordConfirmation,
    sensitiveConfirmationUrl,
}: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title={t('settings.deleteAccount.title')}
                description={t('settings.deleteAccount.description')}
            />
            <div className="space-y-4 rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                <div className="relative space-y-0.5 text-red-600 dark:text-red-100">
                    <p className="font-medium">
                        {t('settings.deleteAccount.warning')}
                    </p>
                    <p className="text-sm">
                        {t('settings.deleteAccount.warningDescription')}
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="destructive"
                            data-test="delete-user-button"
                        >
                            <Trash2Icon data-icon="inline-start" />
                            {t('settings.deleteAccount.title')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            {t('settings.deleteAccount.confirmTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('settings.deleteAccount.confirmDescription')}
                        </DialogDescription>

                        {!usesPasswordConfirmation &&
                            sensitiveConfirmationUrl && (
                                <Form
                                    action={sensitiveConfirmationUrl}
                                    method="post"
                                    className="space-y-4"
                                >
                                    {({ processing }) => (
                                        <Button
                                            type="submit"
                                            variant="secondary"
                                            disabled={processing}
                                        >
                                            <MailCheckIcon data-icon="inline-start" />
                                            {t(
                                                'settings.deleteAccount.sendCode',
                                            )}
                                        </Button>
                                    )}
                                </Form>
                            )}

                        <Form
                            {...ProfileController.destroy.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            onError={() => passwordInput.current?.focus()}
                            resetOnSuccess
                            className="space-y-6"
                        >
                            {({ resetAndClearErrors, processing, errors }) => (
                                <>
                                    {usesPasswordConfirmation && (
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor="password"
                                                className="sr-only"
                                            >
                                                {t('auth.password')}
                                            </Label>

                                            <PasswordInput
                                                id="password"
                                                name="password"
                                                ref={passwordInput}
                                                placeholder={t('auth.password')}
                                                autoComplete="current-password"
                                            />

                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>
                                    )}

                                    <InputError message={errors.otp} />

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    resetAndClearErrors()
                                                }
                                            >
                                                <XIcon data-icon="inline-start" />
                                                {t('common.cancel')}
                                            </Button>
                                        </DialogClose>

                                        <Button
                                            variant="destructive"
                                            disabled={processing}
                                            asChild
                                        >
                                            <button
                                                type="submit"
                                                data-test="confirm-delete-user-button"
                                            >
                                                <Trash2Icon data-icon="inline-start" />
                                                {t(
                                                    'settings.deleteAccount.title',
                                                )}
                                            </button>
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
