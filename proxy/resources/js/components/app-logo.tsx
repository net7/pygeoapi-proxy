import type { ComponentProps } from 'react';
import AppLogoIcon, {
    resolveAppLogoDimensions,
} from '@/components/app-logo-icon';

type AppLogoProps = ComponentProps<typeof AppLogoIcon>;

export default function AppLogo({ width, height, ...props }: AppLogoProps) {
    const dimensions = resolveAppLogoDimensions({ width, height });

    return <AppLogoIcon {...props} {...dimensions} />;
}
