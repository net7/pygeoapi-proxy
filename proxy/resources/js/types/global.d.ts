import type { Language } from '@/lib/i18n/languages';
import type { Auth } from '@/types/auth';
import type { SupportLimits } from '@/types/support';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            language: Language;
            auth: Auth;
            sidebarOpen: boolean;
            support: SupportLimits & { allowGuests: boolean };
            [key: string]: unknown;
        };
    }
}
