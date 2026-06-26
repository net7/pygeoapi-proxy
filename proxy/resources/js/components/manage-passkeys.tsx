import { router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import Heading from '@/components/heading';
import PasskeyItem from '@/components/passkey-item';
import PasskeyRegistration from '@/components/passkey-register';
import { useTranslation } from '@/hooks/use-translation';
import type { Passkey, PasskeyManagementRoutes } from '@/types/auth';

export type Props = {
    canManagePasskeys?: boolean;
    passkeyRoutes?: PasskeyManagementRoutes | null;
    passkeys?: Passkey[];
};

const EmptyState = () => {
    const { t } = useTranslation();

    return (
        <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <KeyRound className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">{t('settings.passkeys.emptyTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.passkeys.emptyDescription')}
            </p>
        </div>
    );
};

export default function ManagePasskeys(props: Props) {
    const { t } = useTranslation();
    const passkeys = props.passkeys ?? [];
    const routes = props.passkeyRoutes;

    const handleDelete = (id: number, onError: () => void) => {
        if (!routes) {
            return;
        }

        router.delete(
            routes.destroy.replace(
                '__PASSKEY_ID__',
                encodeURIComponent(String(id)),
            ),
            {
                preserveScroll: true,
                onError,
            },
        );
    };

    const handleRegisterSuccess = () => {
        router.reload();
    };

    if (!(props.canManagePasskeys ?? false) || !routes) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title={t('settings.passkeys.title')}
                description={t('settings.passkeys.description')}
            />

            <div className="overflow-hidden rounded-lg border border-border">
                {passkeys.length > 0 ? (
                    passkeys.map((passkey) => (
                        <PasskeyItem
                            key={passkey.id}
                            passkey={passkey}
                            onDelete={handleDelete}
                        />
                    ))
                ) : (
                    <EmptyState />
                )}
            </div>

            <PasskeyRegistration
                routes={routes}
                onSuccess={handleRegisterSuccess}
            />
        </div>
    );
}
