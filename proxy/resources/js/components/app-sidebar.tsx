import { Link, usePage } from '@inertiajs/react';
import {
    BriefcaseBusiness,
    ListChecks,
    UsersRound,
    Workflow,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import INGV_LOGO_SHORT_IMAGE from '@/images/ingv-logo-short.png';
import { index as adminJobsIndex } from '@/routes/admin/jobs';
import { index as adminUsersIndex } from '@/routes/admin/users';
import { index as jobsIndex } from '@/routes/jobs';
import { index as processesIndex } from '@/routes/processes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'My Jobs',
        titleKey: 'navigation.myJobs',
        href: jobsIndex(),
        icon: BriefcaseBusiness,
    },
    {
        title: 'Processes',
        titleKey: 'navigation.processes',
        href: processesIndex(),
        icon: Workflow,
    },
];

const administrationNavItems: NavItem[] = [
    {
        title: 'All Users',
        titleKey: 'navigation.allUsers',
        href: adminUsersIndex(),
        icon: UsersRound,
    },
    {
        title: 'All Jobs',
        titleKey: 'navigation.allJobs',
        href: adminJobsIndex(),
        icon: ListChecks,
    },
];

const footerNavItems: NavItem[] = [
    // {
    //     title: 'Repository',
    //     href: 'https://github.com/laravel/react-starter-kit',
    //     icon: FolderGit2,
    // },
    // {
    //     title: 'Documentation',
    //     href: 'https://laravel.com/docs/starter-kits#react',
    //     icon: BookOpen,
    // },
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const { state } = useSidebar();
    const { t } = useTranslation();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={jobsIndex()} prefetch>
                                <AppLogo
                                    collapsed={state === 'collapsed'}
                                    collapsedLogoSrc={INGV_LOGO_SHORT_IMAGE}
                                />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
                {auth.user?.is_admin && (
                    <NavMain
                        label={t('navigation.administration')}
                        items={administrationNavItems}
                    />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
