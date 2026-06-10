import { Form, Head, usePage } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
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

function GoogleLogo() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
            />
        </svg>
    );
}

function OrcidLogo() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
            <circle cx="12" cy="12" r="11" fill="#A6CE39" />
            <path
                fill="#fff"
                d="M7.7 8.6h1.8v8.2H7.7V8.6zm.9-3.1a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zm3.2 3.1h3.1c2.7 0 4.5 1.6 4.5 4.1s-1.8 4.1-4.5 4.1h-3.1V8.6zm1.8 1.6v5h1.1c1.8 0 2.8-.9 2.8-2.5s-1-2.5-2.8-2.5h-1.1z"
            />
        </svg>
    );
}

function ProviderLogo({ provider }: { provider: string }) {
    if (provider === 'google') {
        return <GoogleLogo />;
    }

    if (provider === 'orcid') {
        return <OrcidLogo />;
    }

    return null;
}

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
                                    <ProviderLogo
                                        provider={provider.provider}
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
                                        {processing && <Spinner />}
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
