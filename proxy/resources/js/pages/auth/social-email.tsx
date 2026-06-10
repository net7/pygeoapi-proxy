import { Form, Head } from '@inertiajs/react';
import { MailCheckIcon } from 'lucide-react';
import InputError from '@/components/input-error';
import StatusNotice from '@/components/status-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    email?: string;
    status?: string;
    submitUrl: string;
};

export default function SocialEmail({ email = '', status, submitUrl }: Props) {
    return (
        <>
            <Head title="Verify email" />

            <Form
                action={submitUrl}
                method="post"
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                    defaultValue={email}
                                />
                                <InputError message={errors.email} />
                            </div>

                            <Button type="submit" className="w-full">
                                {processing ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <MailCheckIcon data-icon="inline-start" />
                                )}
                                Send code
                            </Button>
                        </div>

                        <StatusNotice message={status} title="Code sent" />
                    </>
                )}
            </Form>
        </>
    );
}

SocialEmail.layout = {
    title: 'Verify your email',
    description: 'Enter the email address to link with this account',
};
