import type { ComponentProps } from 'react';
import INGV_LOGO_WHITE_IMAGE from '@/images/ingv-logo-white.svg';
import INGV_LOGO_IMAGE from '@/images/invg-logo.svg';
import { cn } from '@/lib/utils';

type AppLogoIconProps = Omit<ComponentProps<'img'>, 'src'> & {
    appearance?: 'auto' | 'inverse';
    collapsed?: boolean;
    collapsedLogoSrc?: string;
};

const LOGO_VIEWBOX_WIDTH = 890;
const LOGO_VIEWBOX_HEIGHT = 200;
const LOGO_ASPECT_RATIO = LOGO_VIEWBOX_WIDTH / LOGO_VIEWBOX_HEIGHT;
const COLLAPSED_LOGO_WIDTH = 26;
const COLLAPSED_LOGO_HEIGHT = 40;

export const APP_LOGO_DEFAULT_WIDTH = 400;
export const APP_LOGO_DEFAULT_HEIGHT = Math.round(
    APP_LOGO_DEFAULT_WIDTH / LOGO_ASPECT_RATIO,
);

export function resolveAppLogoDimensions({
    width,
    height,
}: Pick<AppLogoIconProps, 'width' | 'height'>) {
    return {
        width:
            width ??
            (typeof height === 'number'
                ? Math.round(height * LOGO_ASPECT_RATIO)
                : APP_LOGO_DEFAULT_WIDTH),
        height:
            height ??
            (typeof width === 'number'
                ? Math.round(width / LOGO_ASPECT_RATIO)
                : APP_LOGO_DEFAULT_HEIGHT),
    };
}

export default function AppLogoIcon({
    alt = 'INGV Logo',
    className,
    appearance = 'auto',
    collapsed = false,
    collapsedLogoSrc,
    width,
    height,
    ...props
}: AppLogoIconProps) {
    const dimensions = resolveAppLogoDimensions({ width, height });

    if (collapsed && collapsedLogoSrc) {
        return (
            <img
                {...props}
                width={COLLAPSED_LOGO_WIDTH}
                height={COLLAPSED_LOGO_HEIGHT}
                className={cn(
                    className,
                    'mx-auto shrink-0 object-contain',
                    appearance === 'inverse' && 'brightness-0 invert',
                )}
                src={collapsedLogoSrc}
                alt={alt}
            />
        );
    }

    return (
        <>
            <img
                {...props}
                {...dimensions}
                className={cn(
                    className,
                    appearance === 'inverse' ? 'hidden' : 'dark:hidden',
                )}
                src={INGV_LOGO_IMAGE}
                alt={alt}
            />
            <img
                {...props}
                {...dimensions}
                className={cn(
                    className,
                    appearance === 'inverse' ? 'block' : 'hidden dark:block',
                )}
                src={INGV_LOGO_WHITE_IMAGE}
                alt={alt}
            />
        </>
    );
}
