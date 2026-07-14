import { Form, Head } from '@inertiajs/react';
import { ShieldCheckIcon } from 'lucide-react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManagePasskeys from '@/components/manage-passkeys';
import PasswordInput from '@/components/password-input';
import StatusNotice from '@/components/status-notice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import { edit } from '@/routes/security';

type Props = {
    canUpdatePassword: boolean;
    passwordRules: string;
    sensitiveConfirmationUrl: string | null;
    status?: string;
} & ManagePasskeysProps;

export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('settings.security.title')} />

            <h1 className="sr-only">{t('settings.security.title')}</h1>

            <StatusNotice
                message={props.status}
                title={t('settings.security.codeSent')}
            />

            {props.canUpdatePassword && (
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.security.updatePassword')}
                        description={t('settings.security.description')}
                    />

                    <Form
                        {...SecurityController.update.form()}
                        options={{
                            preserveScroll: true,
                        }}
                        resetOnError={[
                            'password',
                            'password_confirmation',
                            'current_password',
                        ]}
                        resetOnSuccess
                        onError={(errors) => {
                            if (errors.password) {
                                passwordInput.current?.focus();
                            }

                            if (errors.current_password) {
                                currentPasswordInput.current?.focus();
                            }
                        }}
                        className="space-y-6"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="current_password">
                                        {t('settings.security.currentPassword')}
                                    </Label>

                                    <PasswordInput
                                        id="current_password"
                                        ref={currentPasswordInput}
                                        name="current_password"
                                        className="mt-1 block w-full"
                                        autoComplete="current-password"
                                        placeholder={t(
                                            'settings.security.currentPassword',
                                        )}
                                    />

                                    <InputError
                                        message={errors.current_password}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password">
                                        {t('settings.security.newPassword')}
                                    </Label>

                                    <PasswordInput
                                        id="password"
                                        ref={passwordInput}
                                        name="password"
                                        className="mt-1 block w-full"
                                        autoComplete="new-password"
                                        placeholder={t(
                                            'settings.security.newPassword',
                                        )}
                                        passwordrules={props.passwordRules}
                                    />

                                    <InputError message={errors.password} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="password_confirmation">
                                        {t('settings.security.confirmPassword')}
                                    </Label>

                                    <PasswordInput
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        className="mt-1 block w-full"
                                        autoComplete="new-password"
                                        placeholder={t(
                                            'settings.security.confirmPassword',
                                        )}
                                        passwordrules={props.passwordRules}
                                    />

                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button
                                        disabled={processing}
                                        data-test="update-password-button"
                                    >
                                        <ShieldCheckIcon data-icon="inline-start" />
                                        {t('common.save')}
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </div>
            )}

            <ManagePasskeys
                canManagePasskeys={props.canManagePasskeys}
                passkeyRoutes={props.passkeyRoutes}
                passkeys={props.passkeys}
            />
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Security settings',
            titleKey: 'settings.security.breadcrumb',
            href: edit(),
        },
    ],
};
