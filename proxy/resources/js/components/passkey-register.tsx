import { usePasskeyRegister } from '@laravel/passkeys/react';
import { KeyRoundIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import type { PasskeyRoutePair } from '@/types/auth';

type Props = {
    routes: PasskeyRoutePair;
    onSuccess: () => void;
};

export default function PasskeyRegistration({ routes, onSuccess }: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState(() => {
        const ua = navigator.userAgent;

        const browser = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'].find(
            (browser) => new RegExp(browser).test(ua),
        );

        const os = ['iPhone', 'iPad', 'Android', 'Mac', 'Windows'].find((os) =>
            new RegExp(os).test(ua),
        );

        return [browser, os].filter(Boolean).join(' on ') || '';
    });

    const [showForm, setShowForm] = useState(false);
    const { register, isLoading, error, isSupported } = usePasskeyRegister({
        routes,
        onSuccess: () => {
            setName('');
            setShowForm(false);
            onSuccess();
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            return;
        }

        await register(name);
    };

    const handleCancel = () => {
        setShowForm(false);
        setName('');
    };

    if (!isSupported) {
        return (
            <div className="text-sm text-muted-foreground">
                {t('settings.passkeys.notSupported')}
            </div>
        );
    }

    if (!showForm) {
        return (
            <Button variant="outline" onClick={() => setShowForm(true)}>
                <KeyRoundIcon data-icon="inline-start" />
                {t('settings.passkeys.add')}
            </Button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-border bg-muted/50 p-4"
        >
            <div className="grid gap-2">
                <Label htmlFor="passkey-name">
                    {t('settings.passkeys.nameLabel')}
                </Label>
                <Input
                    id="passkey-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('settings.passkeys.namePlaceholder')}
                    className="mt-1 block w-full border-foreground/20"
                    autoFocus
                />
                <p className="text-xs text-muted-foreground">
                    {t('settings.passkeys.nameDescription')}
                </p>
            </div>

            {error && <InputError message={error} />}

            <div className="flex gap-2">
                <Button type="submit" disabled={isLoading || !name.trim()}>
                    {isLoading ? (
                        <Spinner data-icon="inline-start" />
                    ) : (
                        <KeyRoundIcon data-icon="inline-start" />
                    )}
                    {isLoading
                        ? t('settings.passkeys.registering')
                        : t('settings.passkeys.register')}
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancel}>
                    <XIcon data-icon="inline-start" />
                    {t('common.cancel')}
                </Button>
            </div>
        </form>
    );
}
