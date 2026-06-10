// Components
import { Form, Head } from '@inertiajs/react';
import { MailIcon } from 'lucide-react';
import InputError from '@/components/input-error';
import StatusNotice from '@/components/status-notice';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';

type Props = {
    passwordEmailAction: string;
    status?: string;
};

export default function ForgotPassword({ passwordEmailAction, status }: Props) {
    return (
        <>
            <Head title="Forgot password" />

            <StatusNotice message={status} title="Reset link sent" />

            <div className="flex flex-col gap-6">
                <Form action={passwordEmailAction} method="post">
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    autoFocus
                                    placeholder="email@example.com"
                                />

                                <InputError message={errors.email} />
                            </div>

                            <div className="my-6 flex items-center justify-start">
                                <Button
                                    className="w-full"
                                    disabled={processing}
                                    data-test="email-password-reset-link-button"
                                >
                                    {processing ? (
                                        <Spinner data-icon="inline-start" />
                                    ) : (
                                        <MailIcon data-icon="inline-start" />
                                    )}
                                    Email password reset link
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="flex justify-center gap-1 text-center text-sm text-muted-foreground">
                    <span>Or, return to</span>
                    <TextLink href={login()}>log in</TextLink>
                </div>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Forgot password',
    description: 'Enter your email to receive a password reset link',
};
