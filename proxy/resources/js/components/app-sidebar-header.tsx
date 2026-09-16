import { Breadcrumbs } from '@/components/breadcrumbs';
import LanguageDropdown from '@/components/language-dropdown';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    return (
        <header className="app-toolbar flex h-16 shrink-0 items-center gap-3 px-5 md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <SidebarTrigger className="-ml-1 shrink-0" />
                <span
                    className="mx-1 h-5 w-px shrink-0 bg-border"
                    aria-hidden="true"
                />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <LanguageDropdown />
        </header>
    );
}
