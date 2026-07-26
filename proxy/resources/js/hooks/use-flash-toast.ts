import { router } from '@inertiajs/react';
import { createElement, useEffect } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/use-translation';
import type { FlashToast } from '@/types/ui';

export function useFlashToast(): void {
    const { t } = useTranslation();

    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            toast[data.type](data.title ?? data.message, {
                description: renderToastDescription(data, t),
            });
        });
    }, [t]);
}

function renderToastDescription(
    data: FlashToast,
    t: ReturnType<typeof useTranslation>['t'],
): ReactNode {
    const description =
        data.description ??
        (data.title ? data.message : getToastDescription(data.type, t));

    if (!data.details?.length && !data.note) {
        return description;
    }

    return createElement(
        'div',
        { className: 'grid gap-2' },
        [
            createElement('p', { key: 'description' }, description),
            data.details?.length
                ? createElement(
                      'dl',
                      { key: 'details', className: 'grid gap-1 text-sm' },
                      data.details.map((detail) =>
                          createElement(
                              'div',
                              {
                                  key: detail.label,
                                  className:
                                      'grid grid-cols-[auto_minmax(0,1fr)] gap-x-2',
                              },
                              [
                                  createElement(
                                      'dt',
                                      {
                                          key: 'label',
                                          className: 'text-muted-foreground',
                                      },
                                      `${detail.label}:`,
                                  ),
                                  createElement(
                                      'dd',
                                      { key: 'value', className: 'min-w-0' },
                                      createElement(
                                          'strong',
                                          {
                                              className:
                                                  'font-semibold text-foreground',
                                          },
                                          detail.value,
                                      ),
                                  ),
                              ],
                          ),
                      ),
                  )
                : null,
            data.note
                ? createElement(
                      'p',
                      { key: 'note', className: 'text-muted-foreground' },
                      createElement('em', null, data.note),
                  )
                : null,
        ].filter(Boolean),
    );
}

function getToastDescription(
    type: FlashToast['type'],
    t: ReturnType<typeof useTranslation>['t'],
): string {
    return {
        success: t('toast.defaultSuccess'),
        info: t('toast.defaultInfo'),
        warning: t('toast.defaultWarning'),
        error: t('toast.defaultError'),
    }[type];
}
