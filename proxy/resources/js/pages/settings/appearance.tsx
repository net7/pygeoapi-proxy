import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import LanguageTabs from '@/components/language-tabs';
import { useTranslation } from '@/hooks/use-translation';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('settings.appearance.title')} />

            <h1 className="sr-only">{t('settings.appearance.title')}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('settings.appearance.title')}
                    description={t('settings.appearance.description')}
                />

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Heading
                            variant="small"
                            title={t('settings.appearance.themeTitle')}
                        />
                        <AppearanceTabs />
                    </div>

                    <div className="space-y-2">
                        <Heading
                            variant="small"
                            title={t('settings.appearance.languageTitle')}
                            description={t(
                                'settings.appearance.languageDescription',
                            )}
                        />
                        <LanguageTabs />
                    </div>
                </div>
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance settings',
            titleKey: 'settings.appearance.breadcrumb',
            href: editAppearance(),
        },
    ],
};
