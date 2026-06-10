import { Form, Head } from '@inertiajs/react';
import { ShieldCheckIcon } from 'lucide-react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/password/confirm';
import type { PasskeyRoutePair } from '@/types/auth';

type Props = {
    passkeyConfirmRoutes: PasskeyRoutePair | null;
};

export default function ConfirmPassword({ passkeyConfirmRoutes }: Props) {
    return (
        <>
            <Head title="Confirm password" />

            {passkeyConfirmRoutes && (
                <PasskeyVerify
                    routes={passkeyConfirmRoutes}
                    label="Confirm with passkey"
                    loadingLabel="Confirming..."
                    separator="Or confirm with password"
                />
            )}

            <Form {...store.form()} resetOnSuccess={['password']}>
                {({ processing, errors }) => (
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                placeholder="Password"
                                autoComplete="current-password"
                                autoFocus
                            />

                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-center">
                            <Button
                                className="w-full"
                                disabled={processing}
                                data-test="confirm-password-button"
                            >
                                {processing ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <ShieldCheckIcon data-icon="inline-start" />
                                )}
                                Confirm password
                            </Button>
                        </div>
                    </div>
                )}
            </Form>
        </>
    );
}

ConfirmPassword.layout = {
    title: 'Confirm password',
    description:
        'This is a secure area of the application. Please confirm your password before continuing.',
};
