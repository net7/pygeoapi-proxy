import { Form, Head, Link } from '@inertiajs/react';
import { RefreshCwIcon, ShieldCheckIcon } from 'lucide-react';
import InputError from '@/components/input-error';
import StatusNotice from '@/components/status-notice';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

type Props = {
    email: string;
    status?: string;
    verifyUrl: string;
    resendUrl: string;
};

export default function VerifyOtp({
    email,
    status,
    verifyUrl,
    resendUrl,
}: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('auth.verifyCode.submit')} />

            <Form
                action={verifyUrl}
                method="post"
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="code">
                                    {t('auth.verifyCode.codeLabel')}
                                </Label>
                                <Input
                                    id="code"
                                    type="text"
                                    name="code"
                                    required
                                    autoFocus
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    placeholder="123456"
                                />
                                <InputError message={errors.code} />
                            </div>

                            <Button type="submit" className="w-full">
                                {processing ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <ShieldCheckIcon data-icon="inline-start" />
                                )}
                                {t('auth.verifyCode.submit')}
                            </Button>
                        </div>

                        <Link
                            href={resendUrl}
                            method="post"
                            as="button"
                            className={cn(
                                buttonVariants({ variant: 'outline' }),
                                'w-full',
                            )}
                        >
                            <RefreshCwIcon data-icon="inline-start" />
                            {t('auth.sendNewCode')}
                        </Link>
                    </>
                )}
            </Form>

            <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
                <p>{email}</p>
                <StatusNotice message={status} title={t('auth.codeSent')} />
            </div>
        </>
    );
}

VerifyOtp.layout = {
    title: 'Check your email',
    titleKey: 'auth.verifyCode.title',
    description: 'Enter the code from the verification message',
    descriptionKey: 'auth.verifyCode.description',
};
