import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import type { NavItem } from '@/types';

export function NavMain({
    items = [],
    label,
}: {
    items: NavItem[];
    label?: string;
}) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { t } = useTranslation();
    const resolvedLabel = label ?? t('navigation.platform');

    return (
        <SidebarGroup className="main-navigation px-2 py-0">
            <SidebarGroupLabel>{resolvedLabel}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const title = item.titleKey ? t(item.titleKey) : item.title;

                    return (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentOrParentUrl(item.href)}
                                tooltip={{ children: title }}
                                className="rounded-none data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary"
                            >
                                <Link
                                    href={item.href}
                                    prefetch
                                    aria-current={
                                        isCurrentOrParentUrl(item.href)
                                            ? 'page'
                                            : undefined
                                    }
                                >
                                    {item.icon && <item.icon />}
                                    <span>{title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
