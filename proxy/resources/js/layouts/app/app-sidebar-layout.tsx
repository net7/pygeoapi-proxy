import { usePage } from '@inertiajs/react';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { auth } = usePage().props;

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            {/* Clip animated overflow without creating a second scroll container. */}
            <AppContent variant="sidebar" className="min-w-0 overflow-clip">
                <AppSidebarHeader breadcrumbs={breadcrumbs} user={auth.user} />
                <div data-page-content className="flex min-w-0 flex-1 flex-col">
                    {children}
                </div>
            </AppContent>
        </AppShell>
    );
}
