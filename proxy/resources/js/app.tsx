import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import { NavigationTransition } from '@/components/content-transition';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import { initializeLanguage } from '@/hooks/use-language';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { navigationMotionOptions } from '@/lib/motion';
import { formatPageTitle } from './lib/page-title';
import { reverbOptions } from './lib/reverb-configuration';

const reverbConfiguration =
    typeof document === 'undefined'
        ? null
        : (document.querySelector<HTMLMetaElement>('meta[name="reverb-config"]')
              ?.content ?? null);

configureEcho(reverbOptions(reverbConfiguration));

initializeLanguage();

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => formatPageTitle(title, appName),
    defaults: {
        visitOptions: navigationMotionOptions,
    },
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return NavigationTransition;
            case name.startsWith('auth/'):
                return [NavigationTransition, AuthLayout];
            case name.startsWith('settings/'):
                return [NavigationTransition, AppLayout, SettingsLayout];
            default:
                return [NavigationTransition, AppLayout];
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#167287',
    },
});

// This will set light / dark mode on load...
initializeTheme();
