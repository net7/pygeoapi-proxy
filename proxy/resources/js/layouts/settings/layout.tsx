import { Link } from '@inertiajs/react';
import { PaletteIcon, UserIcon } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import type { NavItem } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        titleKey: 'settings.profile.titleShort',
        href: edit(),
        icon: UserIcon,
    },
    {
        title: 'Appearance',
        titleKey: 'settings.appearance.nav',
        href: editAppearance(),
        icon: PaletteIcon,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { t } = useTranslation();

    return (
        <div className="px-4 py-6">
            <Heading
                title={t('settings.layout.title')}
                description={t('settings.layout.description')}
            />

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav
                        className="settings-navigation flex flex-col gap-1"
                        aria-label={t('settings.layout.ariaLabel')}
                    >
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${toUrl(item.href)}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('h-10 w-full justify-start', {
                                    'bg-accent font-semibold text-primary hover:text-primary':
                                        isCurrentOrParentUrl(item.href),
                                })}
                            >
                                <Link
                                    href={item.href}
                                    aria-current={
                                        isCurrentOrParentUrl(item.href)
                                            ? 'page'
                                            : undefined
                                    }
                                >
                                    {item.icon && (
                                        <item.icon data-icon="inline-start" />
                                    )}
                                    {item.titleKey
                                        ? t(item.titleKey)
                                        : item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1 rounded-xl border border-border bg-card p-5 md:max-w-2xl md:p-8">
                    <section className="flex max-w-xl flex-col gap-12">
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
