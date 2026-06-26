import { Form, Head, usePage } from '@inertiajs/react';
import { LogInIcon } from 'lucide-react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { SocialProviderIcon } from '@/components/social-provider-icon';
import StatusNotice from '@/components/status-notice';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    const { auth } = usePage().props;
    const socialProviders = auth.routes.socialProviders;

    return (
        <>
            <Head title="Access or register" />

            {auth.routes.passkeyLogin && (
                <PasskeyVerify routes={auth.routes.passkeyLogin} />
            )}

            {socialProviders.length > 0 && (
                <section className="flex flex-col gap-5">
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {socialProviders.map((provider) => (
                            <Button
                                key={provider.provider}
                                asChild
                                variant="outline"
                                className="border-zinc-200 bg-white text-zinc-900 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                            >
                                <a
                                    href={provider.redirect}
                                    aria-label={`Access or register with ${provider.label}`}
                                >
                                    <SocialProviderIcon
                                        provider={provider.provider}
                                        data-icon="inline-start"
                                    />
                                    {provider.label}
                                </a>
                            </Button>
                        ))}
                    </div>
                </section>
            )}

            {auth.canUsePasswordLogin && (
                <div className="flex flex-col gap-6">
                    {socialProviders.length > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-medium text-muted-foreground">
                                Oppure
                            </span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                    )}

                    <Form
                        {...store.form()}
                        resetOnSuccess={['password']}
                        className="flex flex-col gap-6"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="email">
                                            Email address
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            autoFocus={
                                                socialProviders.length === 0
                                            }
                                            tabIndex={1}
                                            autoComplete="email"
                                            placeholder="email@example.com"
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <Label htmlFor="password">
                                                Password
                                            </Label>
                                            {canResetPassword &&
                                                auth.routes.passwordRequest && (
                                                    <TextLink
                                                        href={
                                                            auth.routes
                                                                .passwordRequest
                                                        }
                                                        className="text-sm"
                                                        tabIndex={5}
                                                    >
                                                        Forgot your password?
                                                    </TextLink>
                                                )}
                                        </div>
                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            required
                                            tabIndex={2}
                                            autoComplete="current-password"
                                            placeholder="Password"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="remember"
                                            name="remember"
                                            tabIndex={3}
                                        />
                                        <Label htmlFor="remember">
                                            Remember me
                                        </Label>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        tabIndex={4}
                                        disabled={processing}
                                        data-test="login-button"
                                    >
                                        {processing ? (
                                            <Spinner data-icon="inline-start" />
                                        ) : (
                                            <LogInIcon data-icon="inline-start" />
                                        )}
                                        Log in
                                    </Button>
                                </div>

                                {auth.routes.register && (
                                    <div className="text-center text-sm text-muted-foreground">
                                        Don't have an account?{' '}
                                        <TextLink
                                            href={auth.routes.register}
                                            tabIndex={5}
                                        >
                                            Sign up
                                        </TextLink>
                                    </div>
                                )}
                            </>
                        )}
                    </Form>
                </div>
            )}

            <StatusNotice message={status} title="Account notice" />
        </>
    );
}

Login.layout = {
    title: 'Accedi o registrati',
    description: 'Continua con uno dei provider abilitati',
};
